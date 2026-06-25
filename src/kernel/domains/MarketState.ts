import type { KernelEvent, MarketState } from '../types';

export function initialMarketState(): MarketState {
  return {
    symbol:       'BTCUSDT',
    price:        0,
    provider:     'unknown',
    ts:           0,
    stateVersion: 0n,
  };
}

export function applyMarketEvent(state: MarketState, event: KernelEvent): MarketState {
  const p    = event.payload;
  const base = { ...state, stateVersion: event.seq, lastEventId: event.id };

  switch (event.type) {
    case 'KernelSystemSeeded':
      return {
        ...base,
        symbol:   (p.symbol   as string) || state.symbol,
        price:    (p.price    as number) ?? state.price,
        provider: (p.provider as string) || state.provider,
        ts:       (p.ts       as number) ?? Date.now(),
      };

    case 'PriceUpdated':
      return {
        ...base,
        symbol:    (p.symbol   as string) || state.symbol,
        price:     p.price     as number,
        bid:       p.bid       as number | undefined,
        ask:       p.ask       as number | undefined,
        volume24h: p.volume24h as number | undefined,
        provider:  (p.provider as string) || state.provider,
        ts:        p.ts        as number,
      };

    case 'RegimeChanged':
      // Regime is part of StrategyState, but we record the ts here for freshness
      return { ...base, ts: Date.now() };

    default:
      return state;
  }
}
