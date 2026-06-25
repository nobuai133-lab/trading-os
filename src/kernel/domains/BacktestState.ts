import type { KernelEvent, BacktestState } from '../types';

const MIN_TRADES = 50;

export function initialBacktestState(): BacktestState {
  return {
    status:             'NOT_STARTED',
    tradeCount:         0,
    minTradesRequired:  MIN_TRADES,
    governanceApproved: false,
    stateVersion:       0n,
  };
}

export function applyBacktestEvent(state: BacktestState, event: KernelEvent): BacktestState {
  const p    = event.payload;
  const base = { ...state, stateVersion: event.seq, lastEventId: event.id };

  switch (event.type) {
    case 'TradeClosed':
    case 'StopLossHit':
    case 'TradeManuallyClosed': {
      const count = state.tradeCount + 1;
      const status: BacktestState['status'] =
        state.governanceApproved ? 'APPROVED' :
        count >= MIN_TRADES ? 'IN_PROGRESS' :
        state.status;
      return { ...base, tradeCount: count, status };
    }

    case 'BacktestApproved':
      return {
        ...base,
        status:             'APPROVED',
        governanceApproved: true,
        approvedAt:         event.ts,
        approvedBy:         p.approvedBy as string | undefined,
        notes:              p.notes      as string | undefined,
      };

    case 'BacktestRejected':
      return {
        ...base,
        status: 'REJECTED',
        notes:  p.notes as string | undefined,
      };

    default:
      return state;
  }
}
