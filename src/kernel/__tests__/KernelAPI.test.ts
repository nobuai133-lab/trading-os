import { describe, it, expect, beforeEach } from 'vitest';
import { CoreStateKernel } from '../KernelAPI';
import type { IEventStore }    from '../store/EventStore';
import type { ISnapshotStore } from '../store/SnapshotStore';
import type { KernelEvent, KernelEventInput, KernelSnapshot } from '../types';
import { KERNEL_DOMAINS } from '../types';

// ── In-memory store fakes ───────────────────────────────────────────────────

class MemEventStore implements IEventStore {
  readonly events: KernelEvent[] = [];

  async getLatestSeq(): Promise<bigint> {
    return this.events.length > 0 ? this.events[this.events.length - 1].seq : 0n;
  }
  async nextSeq(): Promise<bigint> {
    return (await this.getLatestSeq()) + 1n;
  }
  async append(input: KernelEventInput, seq: bigint, previousSeq: bigint): Promise<KernelEvent> {
    const ev: KernelEvent = {
      id: `evt_${seq}`, seq, previousSeq,
      ts: new Date().toISOString(),
      correlationId: input.correlationId,
      sessionId: 'test-session',
      source: input.source,
      domain: input.domain,
      type: input.type,
      version: input.version ?? 1,
      tradeId: input.tradeId,
      setupId: input.setupId,
      payload: input.payload,
    };
    this.events.push(ev);
    return ev;
  }
  async readFrom(seq: bigint, limit = 10_000): Promise<KernelEvent[]> {
    return this.events.filter((e) => e.seq >= seq).slice(0, limit);
  }
  async readById(id: string): Promise<KernelEvent | null> {
    return this.events.find((e) => e.id === id) ?? null;
  }
}

class MemSnapshotStore implements ISnapshotStore {
  readonly snapshots: KernelSnapshot[] = [];

  async save(s: KernelSnapshot): Promise<void> {
    const idx = this.snapshots.findIndex((x) => x.id === s.id);
    if (idx >= 0) this.snapshots[idx] = s; else this.snapshots.push(s);
  }
  async loadLatest(): Promise<KernelSnapshot | null> {
    if (!this.snapshots.length) return null;
    return this.snapshots.reduce((a, b) => (a.seq > b.seq ? a : b));
  }
  async loadAt(seq: bigint): Promise<KernelSnapshot | null> {
    const valid = this.snapshots.filter((s) => s.seq <= seq);
    if (!valid.length) return null;
    return valid.reduce((a, b) => (a.seq > b.seq ? a : b));
  }
}

function makeInput(overrides: Partial<KernelEventInput> = {}): KernelEventInput {
  return {
    correlationId: 'cid_test',
    source:        'test',
    domain:        'trade',
    type:          'SetupDetected',
    payload:       { symbol: 'BTCUSDT', timeframe: '1H', direction: 'LONG' },
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CoreStateKernel.initialize()', () => {
  it('boots with default state when stores are empty', async () => {
    const kernel = new CoreStateKernel(new MemEventStore(), new MemSnapshotStore());
    await kernel.initialize();
    expect(kernel.isInitialized()).toBe(true);
    expect(kernel.getEventCount()).toBe(0);
  });

  it('initializes all 13 domains', async () => {
    const kernel = new CoreStateKernel(new MemEventStore(), new MemSnapshotStore());
    await kernel.initialize();
    for (const domain of KERNEL_DOMAINS) {
      expect(() => kernel.readState(domain)).not.toThrow();
    }
  });

  it('replays trailing events after snapshot', async () => {
    const evStore   = new MemEventStore();
    const snapStore = new MemSnapshotStore();

    // Kernel A: write 2 events, then snapshot
    const kernelA = new CoreStateKernel(evStore, snapStore);
    await kernelA.initialize();
    await kernelA.writeEvent(makeInput({ type: 'SetupDetected' }));
    await kernelA.writeEvent(makeInput({ type: 'SetupDetected', payload: { symbol: 'ETHUSDT' } }));
    await kernelA.createSnapshot();

    // Write one more event after the snapshot
    await kernelA.writeEvent(makeInput({ type: 'RiskApproved', payload: {} }));

    // Kernel B: boot from same stores — should see all 3 events applied
    const kernelB = new CoreStateKernel(evStore, snapStore);
    await kernelB.initialize();
    expect(kernelB.getEventCount()).toBeGreaterThanOrEqual(3);
  });
});

describe('CoreStateKernel.writeEvent()', () => {
  let kernel: CoreStateKernel;
  let evStore: MemEventStore;

  beforeEach(async () => {
    evStore = new MemEventStore();
    kernel  = new CoreStateKernel(evStore, new MemSnapshotStore());
    await kernel.initialize();
  });

  it('persists event to the store', async () => {
    await kernel.writeEvent(makeInput());
    expect(evStore.events).toHaveLength(1);
    expect(evStore.events[0].seq).toBe(1n);
  });

  it('assigns sequential seq values', async () => {
    await kernel.writeEvent(makeInput());
    await kernel.writeEvent(makeInput());
    expect(evStore.events[0].seq).toBe(1n);
    expect(evStore.events[1].seq).toBe(2n);
  });

  it('increments eventCount', async () => {
    await kernel.writeEvent(makeInput());
    await kernel.writeEvent(makeInput());
    expect(kernel.getEventCount()).toBe(2);
  });

  it('updates trade domain state on SetupDetected', async () => {
    await kernel.writeEvent(makeInput({ type: 'SetupDetected', payload: { symbol: 'BTCUSDT', timeframe: '1H', direction: 'LONG' } }));
    const trade = kernel.readState('trade');
    expect(trade.phase).toBe('SETUP_DETECTED');
  });

  it('rejects event with missing correlationId', async () => {
    await expect(kernel.writeEvent(makeInput({ correlationId: '' }))).rejects.toThrow('correlationId');
  });

  it('rejects event with missing type', async () => {
    await expect(kernel.writeEvent(makeInput({ type: '' }))).rejects.toThrow();
  });
});

describe('CoreStateKernel.applyTransition()', () => {
  let kernel: CoreStateKernel;

  beforeEach(async () => {
    kernel = new CoreStateKernel(new MemEventStore(), new MemSnapshotStore());
    await kernel.initialize();
    // Establish a trade in POSITION_OPEN
    await kernel.writeEvent(makeInput({ type: 'SetupDetected',    payload: { symbol: 'BTCUSDT', timeframe: '1H', direction: 'LONG' } }));
    await kernel.writeEvent(makeInput({ type: 'RiskApproved',     payload: {} }));
    await kernel.writeEvent(makeInput({ type: 'EntryConfirmed',   payload: { tradeId: 'trade_1', entry: 50000, sl: 49000 } }));
  });

  it('returns a single event for a valid in-order TP1Hit', async () => {
    const events = await kernel.applyTransition(makeInput({ type: 'TP1Hit', payload: {} }));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('TP1Hit');
  });

  it('auto-reconciles TP2Hit when phase is POSITION_OPEN (TP1 never recorded)', async () => {
    const events = await kernel.applyTransition(makeInput({ type: 'TP2Hit', payload: {} }));
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('TP1HitReconciled');
    expect(events[1].type).toBe('TP2Hit');
    expect(kernel.readState('trade').phase).toBe('TP2_REACHED');
  });

  it('auto-reconciles TP3Hit from POSITION_OPEN (both TP1 and TP2 missing)', async () => {
    const events = await kernel.applyTransition(makeInput({ type: 'TP3Hit', payload: {} }));
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('TP1HitReconciled');
    expect(events[1].type).toBe('TP2HitReconciled');
    expect(events[2].type).toBe('TP3Hit');
  });

  it('auto-reconciles TP3Hit from TP1_REACHED (only TP2 missing)', async () => {
    await kernel.writeEvent(makeInput({ type: 'TP1Hit', payload: {} }));
    const events = await kernel.applyTransition(makeInput({ type: 'TP3Hit', payload: {} }));
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('TP2HitReconciled');
    expect(events[1].type).toBe('TP3Hit');
  });
});

describe('CoreStateKernel.readState() / readFullState()', () => {
  it('throws before initialize', () => {
    const kernel = new CoreStateKernel(new MemEventStore(), new MemSnapshotStore());
    expect(() => kernel.readState('trade')).toThrow('not initialized');
  });

  it('readFullState returns object with all 13 domains', async () => {
    const kernel = new CoreStateKernel(new MemEventStore(), new MemSnapshotStore());
    await kernel.initialize();
    const full = kernel.readFullState();
    for (const domain of KERNEL_DOMAINS) {
      expect(full).toHaveProperty(domain);
    }
  });
});

describe('CoreStateKernel.createSnapshot()', () => {
  it('saves a snapshot with current state', async () => {
    const evStore   = new MemEventStore();
    const snapStore = new MemSnapshotStore();
    const kernel    = new CoreStateKernel(evStore, snapStore);
    await kernel.initialize();
    await kernel.writeEvent(makeInput());
    const snap = await kernel.createSnapshot();
    expect(snap.seq).toBe(1n);
    expect(snap.eventCount).toBe(1);
    expect(snapStore.snapshots).toHaveLength(1);
  });
});
