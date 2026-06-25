// Compatibility shim — re-exports from the new market data engine.
// All existing callers (stateBuilder, historicalScan, API routes) continue to work unchanged.
export type { OHLCVBar } from './marketData/types';
export { marketDataEngine } from './marketData/engine';

import { marketDataEngine } from './marketData/engine';
marketDataEngine.init();

export async function fetchOHLCV(
  symbol: string,
  timeframe: string,
  limit = 200,
) {
  return marketDataEngine.fetchOHLCV(symbol, timeframe, limit);
}

export async function fetchCurrentPrice(symbol: string): Promise<number> {
  return marketDataEngine.fetchCurrentPrice(symbol);
}
