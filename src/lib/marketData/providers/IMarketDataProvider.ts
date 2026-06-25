import type { OHLCVBar, Ticker, OrderBook, FundingRate, OpenInterest, ProviderHealth } from '../types';

export interface IMarketDataProvider {
  readonly name:       string;
  readonly priority:   number;
  readonly priceBasis: 'PERP' | 'SPOT';

  isAvailable(): boolean;
  getHealth():   ProviderHealth;

  fetchOHLCV(symbol: string, timeframe: string, limit?: number): Promise<OHLCVBar[]>;
  fetchTicker(symbol: string):      Promise<Ticker>;
  fetchOrderBook(symbol: string, depth?: number): Promise<OrderBook>;
  fetchFundingRate(symbol: string): Promise<FundingRate>;
  fetchOpenInterest(symbol: string): Promise<OpenInterest>;
}
