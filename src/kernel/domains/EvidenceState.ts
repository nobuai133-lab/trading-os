import type { KernelEvent, EvidenceState } from '../types';

export function initialEvidenceState(): EvidenceState {
  return {
    correlationId: '',
    symbol:        'BTCUSDT',
    grade:         'C',
    confidence:    0,
    categories:    [],
    lastUpdated:   new Date(0).toISOString(),
    stateVersion:  0n,
  };
}

export function applyEvidenceEvent(state: EvidenceState, event: KernelEvent): EvidenceState {
  const p    = event.payload;
  const base = { ...state, stateVersion: event.seq, lastEventId: event.id };

  switch (event.type) {
    case 'EvidenceUpdated':
      return {
        ...base,
        correlationId: (p.correlationId as string) || state.correlationId,
        symbol:        (p.symbol        as string) || state.symbol,
        tradeId:       p.tradeId        as string | undefined,
        grade:         (p.grade         as string) || state.grade,
        confidence:    (p.confidence    as number) ?? state.confidence,
        categories:    Array.isArray(p.categories) ? p.categories as EvidenceState['categories'] : state.categories,
        lastUpdated:   event.ts,
      };

    default:
      return state;
  }
}
