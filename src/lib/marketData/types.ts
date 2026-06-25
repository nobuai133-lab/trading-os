export interface OHLCVBar {
  openTime: number;
  open:     number;
  high:     number;
  low:      number;
  close:    number;
  volume:   number;
}

export interface Ticker {
  symbol:    string;
  bid:       number;
  ask:       number;
  last:      number;
  volume24h: number;
  ts:        number;
}

export interface OrderBook {
  symbol: string;
  bids:   [number, number][];
  asks:   [number, number][];
  ts:     number;
}

export interface FundingRate {
  symbol:          string;
  rate:            number;
  nextFundingTime: number;
}

export interface OpenInterest {
  symbol:       string;
  openInterest: number;
  ts:           number;
}

export interface RateLimitStatus {
  used:    number;
  limit:   number;
  resetAt: number;
  pct:     number;
}

export interface ProviderHealth {
  provider:     string;
  available:    boolean;
  availability: number;
  latency:      number;
  freshness:    number;
  consistency:  number;
  rateLimit:    RateLimitStatus;
  reliability:  number;
  overallScore: number;
  lastCheck:    string;
  lastError?:   string;
}

export interface ValidationWarning {
  type:      'TIMESTAMP_ORDER' | 'MISSING_CANDLES' | 'DUPLICATE_CANDLE' |
             'PRICE_DEVIATION' | 'VOLUME_ANOMALY'  | 'CLOCK_DRIFT' |
             'STALE_DATA'      | 'GAP_DETECTED';
  severity:  'low' | 'medium' | 'high';
  detail:    string;
  barIndex?: number;
}

export interface ValidationResult {
  valid:    boolean;
  bars:     OHLCVBar[];
  warnings: ValidationWarning[];
}

export interface FailoverEvent {
  from:   string;
  to:     string;
  reason: string;
  ts:     string;
}
