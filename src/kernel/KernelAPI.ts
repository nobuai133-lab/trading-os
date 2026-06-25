import type {
  KernelDomain, KernelEvent, KernelEventInput, KernelFullState,
  KernelSnapshot, DomainStates, TradeState,
} from './types';
import { KERNEL_DOMAINS } from './types';
import { KernelConfig } from './KernelConfig';
import { StateCache } from './store/StateCache';
import type { IEventStore } from './store/EventStore';
import type { ISnapshotStore } from './store/SnapshotStore';
import { validateEventInput } from './KernelValidator';

import { initialTradeState,        applyTradeEvent }        from './domains/TradeState';
import { initialMarketState,       applyMarketEvent }       from './domains/MarketState';
import { initialProviderState,     applyProviderEvent }     from './domains/ProviderState';
import { initialStrategyState,     applyStrategyEvent }     from './domains/StrategyState';
import { initialEvidenceState,     applyEvidenceEvent }     from './domains/EvidenceState';
import { initialRiskState,         applyRiskEvent }         from './domains/RiskState';
import { initialLifecycleState,    applyLifecycleEvent }    from './domains/LifecycleState';
import { initialMemoryState,       applyMemoryEvent }       from './domains/MemoryState';
import { initialPortfolioState,    applyPortfolioEvent }    from './domains/PortfolioState';
import { initialNotificationState, applyNotificationEvent } from './domains/NotificationState';
import { initialBacktestState,     applyBacktestEvent }     from './domains/BacktestState';
import { initialReplayState,       applyReplayEvent }       from './domains/ReplayState';
import { initialSystemDomainState, applySystemEvent }       from './domains/SystemDomainState';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyReducer = { initial: () => any; apply: (s: any, e: KernelEvent) => any };

const DOMAIN_REDUCERS: Record<KernelDomain, AnyReducer> = {
  trade:        { initial: initialTradeState,        apply: applyTradeEvent },
  market:       { initial: initialMarketState,       apply: applyMarketEvent },
  provider:     { initial: initialProviderState,     apply: applyProviderEvent },
  strategy:     { initial: initialStrategyState,     apply: applyStrategyEvent },
  evidence:     { initial: initialEvidenceState,     apply: applyEvidenceEvent },
  risk:         { initial: initialRiskState,         apply: applyRiskEvent },
  lifecycle:    { initial: initialLifecycleState,    apply: applyLifecycleEvent },
  memory:       { initial: initialMemoryState,       apply: applyMemoryEvent },
  portfolio:    { initial: initialPortfolioState,    apply: applyPortfolioEvent },
  notification: { initial: initialNotificationState, apply: applyNotificationEvent },
  backtest:     { initial: initialBacktestState,     apply: applyBacktestEvent },
  replay:       { initial: initialReplayState,       apply: applyReplayEvent },
  system:       { initial: initialSystemDomainState, apply: applySystemEvent },
};

export interface ICoreStateKernel {
  initialize(): Promise<void>;
  readState<K extends KernelDomain>(domain: K): DomainStates[K];
  readFullState(): KernelFullState;
  writeEvent(input: KernelEventInput): Promise<KernelEvent>;
  applyTransition(input: KernelEventInput): Promise<KernelEvent[]>;
  createSnapshot(): Promise<KernelSnapshot>;
  replayFrom(seq: bigint): Promise<void>;
  rollbackTo(seq: bigint): Promise<void>;
  getEventCount(): number;
  isInitialized(): boolean;
}

export class CoreStateKernel implements ICoreStateKernel {
  private readonly cache = new StateCache();
  private _eventCount    = 0;
  private _writeQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly eventStore:    IEventStore,
    private readonly snapshotStore: ISnapshotStore,
  ) {}

  // ── Initialization ──────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    const snapshot = await this.snapshotStore.loadLatest();
    if (snapshot) {
      this.cache.setAll(snapshot.state);
      this._eventCount = snapshot.eventCount;
      const trailing = await this.eventStore.readFrom(snapshot.seq + 1n);
      for (const ev of trailing) {
        this._applyToCache(ev);
        this._eventCount++;
      }
    } else {
      this._initDefaults();
      const events = await this.eventStore.readFrom(1n);
      for (const ev of events) {
        this._applyToCache(ev);
        this._eventCount++;
      }
    }
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  readState<K extends KernelDomain>(domain: K): DomainStates[K] {
    const state = this.cache.get(domain);
    if (state === undefined) throw new Error(`Kernel domain '${domain}' not initialized. Call initialize() first.`);
    return state;
  }

  readFullState(): KernelFullState {
    const state = this.cache.getAll();
    if (!state) throw new Error('Kernel not initialized. Call initialize() first.');
    return state;
  }

  getEventCount(): number { return this._eventCount; }
  isInitialized():  boolean { return this.cache.isInitialized(); }

  // ── Write ───────────────────────────────────────────────────────────────────

  async writeEvent(input: KernelEventInput): Promise<KernelEvent> {
    return this._enqueue(() => this._writeEventDirect(input));
  }

  // Validates transitions, emits auto-reconciliation events for out-of-order TPs,
  // then writes the original event. Returns all emitted events in order.
  async applyTransition(input: KernelEventInput): Promise<KernelEvent[]> {
    return this._enqueue(async () => {
      const events: KernelEvent[] = [];
      for (const ri of this._reconciliationEvents(input)) {
        events.push(await this._writeEventDirect(ri));
      }
      events.push(await this._writeEventDirect(input));
      return events;
    });
  }

  // ── Snapshot ────────────────────────────────────────────────────────────────

  async createSnapshot(): Promise<KernelSnapshot> {
    const state    = this.readFullState();
    const latestSeq = await this.eventStore.getLatestSeq();
    const snapshot: KernelSnapshot = {
      id:         `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      seq:        latestSeq,
      createdAt:  new Date().toISOString(),
      eventCount: this._eventCount,
      state,
    };
    await this.snapshotStore.save(snapshot);
    return snapshot;
  }

  // ── Replay & Rollback ───────────────────────────────────────────────────────

  // Rebuild state from nearest snapshot at/before seq, then replay forward to latest.
  async replayFrom(seq: bigint): Promise<void> {
    await this._rebuildToSeq(seq);
    const latestSeq = await this.eventStore.getLatestSeq();
    if (seq < latestSeq) {
      const remaining = await this.eventStore.readFrom(seq + 1n);
      for (const ev of remaining) {
        this._applyToCache(ev);
        this._eventCount++;
      }
    }
  }

  // Rebuild state up to and including targetSeq only (historical snapshot for debugging).
  async rollbackTo(seq: bigint): Promise<void> {
    await this._rebuildToSeq(seq);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _initDefaults(): void {
    for (const domain of KERNEL_DOMAINS) {
      this.cache.set(domain, DOMAIN_REDUCERS[domain].initial());
    }
  }

  private _applyToCache(event: KernelEvent): void {
    for (const domain of KERNEL_DOMAINS) {
      const current = this.cache.get(domain) ?? DOMAIN_REDUCERS[domain].initial();
      this.cache.set(domain, DOMAIN_REDUCERS[domain].apply(current, event));
    }
  }

  private async _writeEventDirect(input: KernelEventInput): Promise<KernelEvent> {
    const v = validateEventInput(input);
    if (!v.valid) {
      throw new Error(`KernelAPI: invalid event — ${v.errors.map((e) => e.message).join('; ')}`);
    }
    if (!this.cache.isInitialized()) this._initDefaults();

    const previousSeq = await this.eventStore.getLatestSeq();
    const seq         = previousSeq + 1n;
    const event       = await this.eventStore.append(input, seq, previousSeq);

    this._applyToCache(event);
    this._eventCount++;

    if (this._eventCount % KernelConfig.snapshotInterval === 0) {
      await this.createSnapshot();
    }

    return event;
  }

  private async _rebuildToSeq(targetSeq: bigint): Promise<void> {
    this.cache.clear();
    this._eventCount = 0;

    const snapshot = await this.snapshotStore.loadAt(targetSeq);
    let startSeq: bigint;

    if (snapshot) {
      this.cache.setAll(snapshot.state);
      this._eventCount = snapshot.eventCount;
      startSeq = snapshot.seq + 1n;
    } else {
      this._initDefaults();
      startSeq = 1n;
    }

    const events = await this.eventStore.readFrom(startSeq);
    for (const ev of events) {
      if (ev.seq > targetSeq) break;
      this._applyToCache(ev);
      this._eventCount++;
    }
  }

  // Returns reconciliation events to emit before an out-of-order TP event.
  // Stage 4 will add hard enforcement; here we auto-reconcile with warnings.
  private _reconciliationEvents(input: KernelEventInput): KernelEventInput[] {
    if (!this.cache.isInitialized()) return [];
    const trade = this.cache.get('trade') as TradeState | undefined;
    if (!trade) return [];

    const base: Omit<KernelEventInput, 'type'> = {
      correlationId: input.correlationId,
      source:        'kernel-reconcile',
      domain:        'trade',
      version:       1,
      tradeId:       input.tradeId,
      setupId:       input.setupId,
      payload:       { outOfOrder: true, originalType: input.type },
    };

    if (input.type === 'TP2Hit' && trade.phase === 'POSITION_OPEN') {
      return [{ ...base, type: 'TP1HitReconciled' }];
    }
    if (input.type === 'TP3Hit') {
      if (trade.phase === 'POSITION_OPEN')
        return [{ ...base, type: 'TP1HitReconciled' }, { ...base, type: 'TP2HitReconciled' }];
      if (trade.phase === 'TP1_REACHED')
        return [{ ...base, type: 'TP2HitReconciled' }];
    }

    return [];
  }

  private _enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this._writeQueue.then(fn);
    this._writeQueue = next.catch(() => undefined);
    return next;
  }
}
