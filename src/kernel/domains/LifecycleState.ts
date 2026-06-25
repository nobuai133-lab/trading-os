import type { KernelEvent, LifecycleState } from '../types';

// Maps TradePhase events to the dashboard's SystemMode equivalent
const PHASE_TO_MODE: Record<string, LifecycleState['mode']> = {
  SetupDetected:          'SETUP_DETECTED',
  RiskApproved:           'WAIT_CONFIRMATION',
  MemoryApproved:         'WAIT_CONFIRMATION',
  EntryConfirmed:         'ACTIVE_TRADE',
  TP1Hit:                 'ACTIVE_TRADE',
  TP1HitReconciled:       'ACTIVE_TRADE',
  TP2Hit:                 'ACTIVE_TRADE',
  TP2HitReconciled:       'ACTIVE_TRADE',
  TP3Hit:                 'ACTIVE_TRADE',
  TP3HitReconciled:       'ACTIVE_TRADE',
  TradeClosed:            'POST_TRADE_REVIEW',
  StopLossHit:            'POST_TRADE_REVIEW',
  TradeManuallyClosed:    'POST_TRADE_REVIEW',
  TradeLifecycleCompleted:'POST_TRADE_REVIEW',
  CooldownStarted:        'COOLDOWN',
  CooldownFinished:       'WAIT_NEW_SETUP',
  RiskRejected:           'IDLE',
  MemoryBlocked:          'IDLE',
  TradeExpired:           'IDLE',
};

// Maps SystemMode to lifecycleIndex (dashboard LifecycleStepper position)
const MODE_TO_INDEX: Record<LifecycleState['mode'], number> = {
  IDLE:              0,
  SETUP_DETECTED:    1,
  WAIT_CONFIRMATION: 2,
  ENTRY_READY:       3,
  ACTIVE_TRADE:      4,
  POST_TRADE_REVIEW: 8,
  WAIT_NEW_SETUP:    9,
  COOLDOWN:          9,
};

export function initialLifecycleState(): LifecycleState {
  return {
    mode:           'IDLE',
    lifecycleIndex: 0,
    cooldownActive: false,
    stateVersion:   0n,
  };
}

export function applyLifecycleEvent(state: LifecycleState, event: KernelEvent): LifecycleState {
  const p    = event.payload;
  const base = { ...state, stateVersion: event.seq, lastEventId: event.id };

  // Update mode based on event type mapping
  const newMode = PHASE_TO_MODE[event.type];

  if (event.type === 'KernelSystemSeeded') {
    return {
      ...base,
      mode:           (p.mode as LifecycleState['mode']) ?? 'IDLE',
      lifecycleIndex: (p.lifecycleIndex as number)       ?? 0,
      cooldownActive: Boolean(p.cooldownActive),
      activeSetupId:  p.activeSetupId as string | undefined,
    };
  }

  if (event.type === 'SetupDetected') {
    return { ...base, mode: 'SETUP_DETECTED', lifecycleIndex: 1, activeSetupId: p.setupId as string | undefined };
  }

  if (event.type === 'CooldownStarted') {
    return { ...base, mode: 'COOLDOWN', lifecycleIndex: 9, cooldownActive: true };
  }

  if (event.type === 'CooldownFinished') {
    return { ...base, mode: 'WAIT_NEW_SETUP', lifecycleIndex: 9, cooldownActive: false };
  }

  if (event.type === 'RiskRejected' || event.type === 'MemoryBlocked' || event.type === 'TradeExpired') {
    return { ...base, mode: 'IDLE', lifecycleIndex: 0, activeSetupId: undefined };
  }

  if (newMode) {
    return { ...base, mode: newMode, lifecycleIndex: MODE_TO_INDEX[newMode] };
  }

  return state;
}
