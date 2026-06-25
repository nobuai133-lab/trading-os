export { marketDataEngine }    from './engine';
export { ProviderManager }     from './providerManager';
export { validateOHLCV, timeframeToMs } from './validator';

export { KrakenProvider }      from './providers/KrakenProvider';
export { BinanceProvider }     from './providers/BinanceProvider';
export { BybitProvider }       from './providers/BybitProvider';
export { CoinbaseProvider }    from './providers/CoinbaseProvider';
export { TradingViewProvider } from './providers/TradingViewProvider';
export { BinanceWsProvider }   from './providers/BinanceWsProvider';

export type { IMarketDataProvider } from './providers/IMarketDataProvider';
export type {
  OHLCVBar,
  Ticker,
  OrderBook,
  FundingRate,
  OpenInterest,
  RateLimitStatus,
  ProviderHealth,
  ValidationWarning,
  ValidationResult,
  FailoverEvent,
} from './types';
