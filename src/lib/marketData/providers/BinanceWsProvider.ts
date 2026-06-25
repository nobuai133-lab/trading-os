import { BaseProvider } from './BaseProvider';
import type { OHLCVBar, Ticker, OrderBook, FundingRate, OpenInterest } from '../types';

/**
 * Binance WebSocket provider stub — R-18.
 * Will replace BinanceProvider for real-time tick data once WS infra is built.
 * Currently deferred: REST fallback is BinanceProvider (priority 1).
 */
export class BinanceWsProvider extends BaseProvider {
  readonly name     = 'binance-ws';
  readonly priority = 3;

  // Not yet implemented — always unavailable
  protected override available = false;

  async fetchOHLCV(_symbol: string, _timeframe: string, _limit?: number): Promise<OHLCVBar[]> {
    throw new Error('BinanceWsProvider: not yet implemented');
  }

  async fetchTicker(_symbol: string): Promise<Ticker> {
    throw new Error('BinanceWsProvider: not yet implemented');
  }

  async fetchOrderBook(_symbol: string, _depth?: number): Promise<OrderBook> {
    throw new Error('BinanceWsProvider: not yet implemented');
  }

  async fetchFundingRate(_symbol: string): Promise<FundingRate> {
    throw new Error('BinanceWsProvider: not yet implemented');
  }

  async fetchOpenInterest(_symbol: string): Promise<OpenInterest> {
    throw new Error('BinanceWsProvider: not yet implemented');
  }
}
