import type { KernelEvent, TradeState } from '../types';

export function initialTradeState(): TradeState {
  return {
    phase:        'IDLE',
    stateVersion: 0n,
    tp1Hit:       false,
    tp2Hit:       false,
    tp3Hit:       false,
  };
}

export function applyTradeEvent(state: TradeState, event: KernelEvent): TradeState {
  const p    = event.payload;
  const base = {
    ...state,
    stateVersion: event.seq,
    lastEventId:  event.id,
    lastEventTs:  event.ts,
  };

  switch (event.type) {
    case 'KernelSystemSeeded':
      // Seed from existing DB state on first Kernel initialisation
      return {
        ...base,
        phase:     (p.phase as TradeState['phase']) ?? 'IDLE',
        tradeId:   p.tradeId as string | undefined,
        setupId:   p.setupId as string | undefined,
        symbol:    p.symbol  as string | undefined,
        direction: p.direction as string | undefined,
        entry:     p.entry   as number | undefined,
        sl:        p.sl      as number | undefined,
        tp1:       p.tp1     as number | undefined,
        tp2:       p.tp2     as number | undefined,
        tp3:       p.tp3     as number | undefined,
        tp1Hit:    Boolean(p.tp1Hit),
        tp2Hit:    Boolean(p.tp2Hit),
        tp3Hit:    Boolean(p.tp3Hit),
        riskPct:   p.riskPct as number | undefined,
        openedAt:  p.openedAt as string | undefined,
      };

    case 'SetupDetected':
      return {
        ...base,
        phase:        'SETUP_DETECTED',
        setupId:      p.setupId  as string | undefined,
        symbol:       p.symbol   as string,
        timeframe:    p.timeframe as string | undefined,
        direction:    p.direction as string | undefined,
        tradeId:      undefined,
        entry:        undefined, sl: undefined,
        tp1: undefined, tp2: undefined, tp3: undefined,
        tp1Hit: false, tp2Hit: false, tp3Hit: false,
        resultR: undefined, openedAt: undefined,
        closedAt: undefined, closeReason: undefined, reconciled: [],
      };

    case 'RiskApproved':
    case 'MemoryApproved':
      // Both events move phase to WAIT_CONFIRMATION (idempotent for the second)
      if (state.phase !== 'SETUP_DETECTED') return state;
      return { ...base, phase: 'WAIT_CONFIRMATION' };

    case 'RiskRejected':
    case 'MemoryBlocked':
      return { ...base, phase: 'IDLE', setupId: undefined, symbol: undefined, direction: undefined };

    case 'EntryConfirmed':
      return {
        ...base,
        phase:    'POSITION_OPEN',
        tradeId:  p.tradeId  as string,
        entry:    p.entry    as number,
        sl:       p.sl       as number | undefined,
        tp1:      p.tp1      as number | undefined,
        tp2:      p.tp2      as number | undefined,
        tp3:      p.tp3      as number | undefined,
        riskPct:  p.riskPct  as number | undefined,
        openedAt: event.ts,
      };

    case 'TP1Hit':
      return { ...base, phase: 'TP1_REACHED', tp1Hit: true };

    case 'TP1HitReconciled':
      return {
        ...base,
        phase:      'TP1_REACHED',
        tp1Hit:     true,
        reconciled: [...(state.reconciled ?? []), 'TP1HitReconciled'],
      };

    case 'TP2Hit':
      return { ...base, phase: 'TP2_REACHED', tp2Hit: true };

    case 'TP2HitReconciled':
      return {
        ...base,
        phase:      'TP2_REACHED',
        tp2Hit:     true,
        reconciled: [...(state.reconciled ?? []), 'TP2HitReconciled'],
      };

    case 'TP3Hit':
      return { ...base, phase: 'TP3_REACHED', tp3Hit: true };

    case 'TP3HitReconciled':
      return {
        ...base,
        phase:      'TP3_REACHED',
        tp3Hit:     true,
        reconciled: [...(state.reconciled ?? []), 'TP3HitReconciled'],
      };

    case 'TradeClosed':
      return {
        ...base,
        phase:       'POSITION_CLOSED',
        closeReason: p.closeReason as string,
        resultR:     p.resultR     as number | undefined,
        closedAt:    event.ts,
      };

    case 'StopLossHit':
      return { ...base, phase: 'POSITION_CLOSED', closeReason: 'SL_HIT', resultR: -1, closedAt: event.ts };

    case 'TradeManuallyClosed':
      return { ...base, phase: 'POSITION_CLOSED', closeReason: 'MANUAL', closedAt: event.ts };

    case 'TradeExpired':
      return { ...base, phase: 'IDLE', tradeId: undefined, setupId: undefined };

    case 'TradeLifecycleCompleted':
      return { ...base, phase: 'POST_REVIEW' };

    case 'CooldownStarted':
      // Trade moves to WAIT_NEW_SETUP after cooldown begins
      if (state.phase === 'POST_REVIEW') return { ...base, phase: 'WAIT_NEW_SETUP' };
      return state;

    default:
      return state;
  }
}
