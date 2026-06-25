import type { KernelEvent, StrategyState } from '../types';

export function initialStrategyState(): StrategyState {
  return {
    symbol:       'BTCUSDT',
    timeframe:    '4H',
    regime:       'UNKNOWN',
    ema20:        0,
    ema50:        0,
    atr:          0,
    confidence:   0,
    htfBias:      'neutral',
    ltfBias:      'neutral',
    keyLevels:    [],
    lastAnalyzed: new Date(0).toISOString(),
    stateVersion: 0n,
  };
}

export function applyStrategyEvent(state: StrategyState, event: KernelEvent): StrategyState {
  const p    = event.payload;
  const base = { ...state, stateVersion: event.seq, lastEventId: event.id };

  switch (event.type) {
    case 'KernelSystemSeeded':
      return {
        ...base,
        symbol:       (p.symbol     as string) || state.symbol,
        timeframe:    (p.timeframe  as string) || state.timeframe,
        regime:       (p.regime     as string) || state.regime,
        ema20:        (p.ema20      as number) ?? state.ema20,
        ema50:        (p.ema50      as number) ?? state.ema50,
        atr:          (p.atr        as number) ?? state.atr,
        confidence:   (p.confidence as number) ?? state.confidence,
        htfBias:      (p.htfBias    as string) || state.htfBias,
        ltfBias:      (p.ltfBias    as string) || state.ltfBias,
        keyLevels:    (p.keyLevels  as unknown[]) ?? state.keyLevels,
        lastAnalyzed: event.ts,
      };

    case 'StrategyAnalyzed':
      return {
        ...base,
        symbol:       (p.symbol    as string) || state.symbol,
        timeframe:    (p.timeframe as string) || state.timeframe,
        regime:       (p.regime    as string) || 'UNKNOWN',
        ema20:        (p.ema20     as number) ?? state.ema20,
        ema50:        (p.ema50     as number) ?? state.ema50,
        atr:          (p.atr       as number) ?? state.atr,
        confidence:   (p.confidence as number) ?? state.confidence,
        htfBias:      (p.htfBias   as string) || state.htfBias,
        ltfBias:      (p.ltfBias   as string) || state.ltfBias,
        keyLevels:    (p.keyLevels as unknown[]) ?? state.keyLevels,
        lastAnalyzed: event.ts,
      };

    case 'RegimeChanged':
      return { ...base, regime: p.regime as string };

    default:
      return state;
  }
}
