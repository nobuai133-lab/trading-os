import { describe, it, expect } from 'vitest';
import { CoreStateKernel } from '../KernelAPI';
import type { IEventStore }    from '../store/EventStore';
import type { ISnapshotStore } from '../store/SnapshotStore';
import type { KernelEvent, KernelEventInput, KernelSnapshot } from '../types';

// ── Reusable fakes (same as KernelAPI.test.ts) ──────────────────────────────

class MemEventStore implements IEventStore {
  readonly events: KernelEvent[] = [];
  async getLatestSeq(): Promise<bigint> {
    return this.events.length > 0 ? this.events[this.events.length - 1].seq : 0n;
  }
  async nextSeq(): Promise<bigint> { return (await this.getLatestSeq()) + 1n; }
  async append(input: KernelEventInput, seq: bigint, previousSeq: bigint): Promise<KernelEvent> {
    const ev: KernelEvent = {
      id: `evt_${seq}`, seq, previousSeq,
      ts: new Date().toISOString(),
      correlationId: input.correlationId, sessionId: 'test',
      source: input.source, domain: input.domain,
      type: input.type, version: input.version ?? 1,
      tradeId: input.tradeId, setupId: input.setupId,
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

function ev(type: string, payload: Record<string, unknown> = {}): KernelEventInput {
  return { correlationId: 'cid', source: 'test', domain: 'trade', type, payload };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('rollbackTo()', () => {
  it('reverts state to an earlier seq', async () => {
    const stores = [new MemEventStore(), new MemSnapshotStore()] as const;
    const kernel = new CoreStateKernel(...stores);
    await kernel.initialize();

    await kernel.writeEvent(ev('SetupDetected', { symbol: 'BTCUSDT', timeframe: '1H', direction: 'LONG' }));
    const snapAfterSeq1 = await kernel.createSnapshot();

    await kernel.writeEvent(ev('RiskApproved', {}));  // seq 2 — moves phase to WAIT_CONFIRMATION
    expect(kernel.readState('trade').phase).toBe('WAIT_CONFIRMATION');

    // Rollback to seq 1 — should see SETUP_DETECTED
    await kernel.rollbackTo(snapAfterSeq1.seq);
    expect(kernel.readState('trade').phase).toBe('SETUP_DETECTED');
  });

  it('rebuilds correct eventCount after rollback', async () => {
    const stores = [new MemEventStore(), new MemSnapshotStore()] as const;
    const kernel = new CoreStateKernel(...stores);
    await kernel.initialize();

    await kernel.writeEvent(ev('SetupDetected', { symbol: 'BTCUSDT', timeframe: '1H', direction: 'LONG' }));
    await kernel.writeEvent(ev('RiskApproved', {}));
    await kernel.writeEvent(ev('EntryConfirmed', { tradeId: 'trade_1', entry: 50000 }));

    await kernel.rollbackTo(1n); // roll back to just after seq 1
    expect(kernel.getEventCount()).toBe(1);
  });

  it('rolls back to before any snapshot (full replay)', async () => {
    const stores = [new MemEventStore(), new MemSnapshotStore()] as const;
    const kernel = new CoreStateKernel(...stores);
    await kernel.initialize();

    await kernel.writeEvent(ev('SetupDetected', { symbol: 'BTCUSDT', timeframe: '1H', direction: 'LONG' }));
    await kernel.writeEvent(ev('RiskApproved', {}));
    await kernel.createSnapshot(); // snapshot at seq 2

    // Rollback to seq 1 — before snapshot
    await kernel.rollbackTo(1n);
    expect(kernel.readState('trade').phase).toBe('SETUP_DETECTED');
    expect(kernel.getEventCount()).toBe(1);
  });
});

describe('replayFrom()', () => {
  it('rebuilds from snapshot and replays trailing events', async () => {
    const stores = [new MemEventStore(), new MemSnapshotStore()] as const;
    const kernel = new CoreStateKernel(...stores);
    await kernel.initialize();

    await kernel.writeEvent(ev('SetupDetected', { symbol: 'BTCUSDT', timeframe: '1H', direction: 'LONG' })); // seq 1
    await kernel.createSnapshot(); // snapshot at seq 1

    await kernel.writeEvent(ev('RiskApproved', {})); // seq 2

    // Replay from seq 1: should arrive at WAIT_CONFIRMATION (seq 2 applied)
    await kernel.replayFrom(1n);
    expect(kernel.readState('trade').phase).toBe('WAIT_CONFIRMATION');
  });

  it('reaches latest state after replayFrom', async () => {
    const stores = [new MemEventStore(), new MemSnapshotStore()] as const;
    const kernel = new CoreStateKernel(...stores);
    await kernel.initialize();

    await kernel.writeEvent(ev('SetupDetected', { symbol: 'BTCUSDT', timeframe: '1H', direction: 'LONG' }));
    await kernel.writeEvent(ev('RiskApproved', {}));
    await kernel.writeEvent(ev('EntryConfirmed', { tradeId: 'trade_1', entry: 50000 }));

    await kernel.replayFrom(1n);
    expect(kernel.readState('trade').phase).toBe('POSITION_OPEN');
    expect(kernel.getEventCount()).toBe(3);
  });
});

describe('snapshot + recovery cycle', () => {
  it('new kernel instance boots from snapshot correctly', async () => {
    const evStore   = new MemEventStore();
    const snapStore = new MemSnapshotStore();

    const k1 = new CoreStateKernel(evStore, snapStore);
    await k1.initialize();
    await k1.writeEvent(ev('SetupDetected', { symbol: 'BTCUSDT', timeframe: '1H', direction: 'LONG' }));
    await k1.writeEvent(ev('RiskApproved', {}));
    await k1.createSnapshot(); // snapshot at seq 2, WAIT_CONFIRMATION
    await k1.writeEvent(ev('EntryConfirmed', { tradeId: 'trade_1', entry: 50000 })); // seq 3

    // New kernel boots from same stores
    const k2 = new CoreStateKernel(evStore, snapStore);
    await k2.initialize();

    expect(k2.readState('trade').phase).toBe('POSITION_OPEN');
    expect(k2.getEventCount()).toBe(3);
  });

  it('system domain eventCount increments correctly across restart', async () => {
    const evStore   = new MemEventStore();
    const snapStore = new MemSnapshotStore();

    const k1 = new CoreStateKernel(evStore, snapStore);
    await k1.initialize();
    for (let i = 0; i < 5; i++) {
      await k1.writeEvent(ev('SetupDetected', { symbol: 'BTCUSDT', timeframe: '1H', direction: 'LONG' }));
    }
    await k1.createSnapshot();
    await k1.writeEvent(ev('RiskApproved', {})); // seq 6

    const k2 = new CoreStateKernel(evStore, snapStore);
    await k2.initialize();
    expect(k2.getEventCount()).toBe(6);
  });
});
