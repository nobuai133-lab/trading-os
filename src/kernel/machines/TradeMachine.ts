import type { TradePhase } from '../types';

const VALID_TRANSITIONS: Record<TradePhase, TradePhase[]> = {
  IDLE:              ['SETUP_DETECTED'],
  SETUP_DETECTED:    ['WAIT_CONFIRMATION', 'IDLE'],
  WAIT_CONFIRMATION: ['ENTRY_READY', 'IDLE'],
  ENTRY_READY:       ['POSITION_OPEN', 'IDLE'],
  POSITION_OPEN:     ['TP1_REACHED', 'POSITION_CLOSED'],
  TP1_REACHED:       ['TP2_REACHED', 'POSITION_CLOSED'],
  TP2_REACHED:       ['TP3_REACHED', 'POSITION_CLOSED'],
  TP3_REACHED:       ['POSITION_CLOSED'],
  POSITION_CLOSED:   ['POST_REVIEW'],
  POST_REVIEW:       ['WAIT_NEW_SETUP', 'SETUP_DETECTED'],
  WAIT_NEW_SETUP:    ['SETUP_DETECTED', 'IDLE'],
};

export interface TradeTransitionResult {
  allowed: boolean;
  reason?: string;
}

export function validateTradeTransition(from: TradePhase, to: TradePhase): TradeTransitionResult {
  if (from === to) {
    return { allowed: false, reason: `Already in phase ${from}` };
  }
  const allowed = VALID_TRANSITIONS[from]?.includes(to) ?? false;
  if (!allowed) {
    const valid = VALID_TRANSITIONS[from]?.join(', ') ?? 'none';
    return { allowed: false, reason: `Invalid transition: ${from} → ${to}. Allowed: [${valid}]` };
  }
  return { allowed: true };
}

export function getAllowedTransitions(from: TradePhase): TradePhase[] {
  return VALID_TRANSITIONS[from] ?? [];
}
