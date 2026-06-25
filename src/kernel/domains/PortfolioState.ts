import type { KernelEvent, PortfolioState } from '../types';

export function initialPortfolioState(): PortfolioState {
  return {
    totalTrades:     0,
    wins:            0,
    losses:          0,
    winRate:         0,
    profitFactor:    0,
    totalR:          0,
    maxDrawdown:     0,
    currentDrawdown: 0,
    peakR:           0,
    lastUpdated:     new Date(0).toISOString(),
    stateVersion:    0n,
  };
}

function recompute(state: PortfolioState): PortfolioState {
  const total = state.wins + state.losses;
  return {
    ...state,
    totalTrades:  total,
    winRate:      total > 0 ? state.wins / total : 0,
    profitFactor: state.losses > 0 ? Math.max(state.totalR, 0) / Math.abs(Math.min(state.totalR, 0) || 1) : (state.totalR > 0 ? Infinity : 0),
  };
}

export function applyPortfolioEvent(state: PortfolioState, event: KernelEvent): PortfolioState {
  const p    = event.payload;
  const base = { ...state, stateVersion: event.seq, lastEventId: event.id, lastUpdated: event.ts };

  switch (event.type) {
    case 'TradeClosed':
    case 'StopLossHit':
    case 'TradeManuallyClosed': {
      const r = (p.resultR as number) ?? 0;
      const isWin = r > 0;
      const totalR = state.totalR + r;
      const peakR  = Math.max(state.peakR, totalR);
      const currentDrawdown = totalR < peakR ? peakR - totalR : 0;
      const maxDrawdown     = Math.max(state.maxDrawdown, currentDrawdown);

      return recompute({
        ...base,
        wins:            isWin ? state.wins + 1 : state.wins,
        losses:          !isWin ? state.losses + 1 : state.losses,
        totalR,
        peakR,
        currentDrawdown,
        maxDrawdown,
      });
    }

    default:
      return state;
  }
}
