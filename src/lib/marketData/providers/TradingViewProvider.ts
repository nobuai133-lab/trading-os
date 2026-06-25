import { BaseProvider } from './BaseProvider';
import type { OHLCVBar, Ticker, OrderBook, FundingRate, OpenInterest } from '../types';

/**
 * TradingView provider — local/manual mode only (MCP bridge).
 * Not available in production Railway deployments.
 * Priority 2 for local development environments.
 */
export class TradingViewProvider extends BaseProvider {
  readonly name       = 'tradingview';
  readonly priority   = 20;
  readonly priceBasis = 'SPOT' as const;

  // Only available when MCP bridge is running locally
  protected override available = false;

  async fetchOHLCV(_symbol: string, _timeframe: string, _limit?: number): Promise<OHLCVBar[]> {
    throw new Error('TradingView provider: not available in server context');
  }

  async fetchTicker(_symbol: string): Promise<Ticker> {
    throw new Error('TradingView provider: not available in server context');
  }

  async fetchOrderBook(_symbol: string, _depth?: number): Promise<OrderBook> {
    throw new Error('TradingView provider: not available in server context');
  }

  async fetchFundingRate(_symbol: string): Promise<FundingRate> {
    throw new Error('TradingView provider: not available in server context');
  }

  async fetchOpenInterest(_symbol: string): Promise<OpenInterest> {
    throw new Error('TradingView provider: not available in server context');
  }
}
