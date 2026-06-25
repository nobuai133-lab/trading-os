export type { ICoreStateKernel } from './KernelAPI';
export { CoreStateKernel } from './KernelAPI';

export type {
  KernelDomain, KernelEvent, KernelEventInput, KernelFullState,
  KernelSnapshot, TradePhase, KernelLifecycleMode, ValidationResult,
  DomainStates,
  TradeState, MarketState, ProviderState, StrategyState, EvidenceState,
  RiskState, LifecycleState, MemoryState, PortfolioState, NotificationState,
  BacktestState, ReplayState, KernelSystemState,
} from './types';
export { KERNEL_DOMAINS, bigIntReplacer, reviveBigIntFields, BIGINT_STATE_FIELDS } from './types';

export type { IEventStore }    from './store/EventStore';
export { PrismaEventStore }    from './store/EventStore';
export type { ISnapshotStore } from './store/SnapshotStore';
export { PrismaSnapshotStore } from './store/SnapshotStore';
export { StateCache }          from './store/StateCache';

export { validateTradeTransition, getAllowedTransitions } from './machines/TradeMachine';
export { validateModeTransition, getAllowedModes }        from './machines/LifecycleMachine';

export { validateEventInput, validateEventChain, validateSingleEvent } from './KernelValidator';
