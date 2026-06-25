import { BaseProvider } from './BaseProvider';
import type { OHLCVBar, Ticker, OrderBook, FundingRate, OpenInterest } from '../types';

const BASE = 'https://api.exchange.coinbase.com';

const TF_MAP: Record<string, number> = {
  '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
  '1H': 3600, '4H': 14400, '1D': 86400,
};

// Coinbase uses dash-separated pairs (BTC-USD)
function toCbPair(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s.endsWith('USDT')) return `${s.slice(0, -4)}-USDT`;
  if (s.endsWith('USD'))  return `${s.slice(0, -3)}-USD`;
  return s;
}

export class CoinbaseProvider extends BaseProvider {
  readonly name     = 'coinbase';
  readonly priority = 5;

  async fetchOHLCV(symbol: string, timeframe: string, limit = 200): Promise<OHLCVBar[]> {
    return this.timed(async () => {
      const pair      = toCbPair(symbol);
      const granularity = TF_MAP[timeframe] ?? 14400;
      const end       = Math.floor(Date.now() / 1000);
      const start     = end - granularity * limit;
      const res = await fetch(`${BASE}/products/${pair}/candles?start=${start}&end=${end}&granularity=${granularity}`);
      if (!res.ok) throw new Error(`Coinbase OHLC ${res.status}`);

      // Returns newest first: [time, low, high, open, close, volume]
      const rows: number[][] = await res.json();
      return rows.slice().reverse().map((r) => ({
        openTime: r[0] * 1000,
        open:     r[3],
        high:     r[2],
        low:      r[1],
        close:    r[4],
        volume:   r[5],
      }));
    });
  }

  async fetchTicker(symbol: string): Promise<Ticker> {
    return this.timed(async () => {
      const pair = toCbPair(symbol);
      const res  = await fetch(`${BASE}/products/${pair}/ticker`);
      if (!res.ok) throw new Error(`Coinbase ticker ${res.status}`);
      const data = await res.json();
      return {
        symbol,
        bid:       parseFloat(data.bid),
        ask:       parseFloat(data.ask),
        last:      parseFloat(data.price),
        volume24h: parseFloat(data.volume),
        ts:        Date.now(),
      };
    });
  }

  async fetchOrderBook(symbol: string, depth = 10): Promise<OrderBook> {
    return this.timed(async () => {
      const pair = toCbPair(symbol);
      const res  = await fetch(`${BASE}/products/${pair}/book?level=2`);
      if (!res.ok) throw new Error(`Coinbase book ${res.status}`);
      const data = await res.json();
      return {
        symbol,
        bids: (data.bids as string[][]).slice(0, depth).map(([p, v]) => [parseFloat(p), parseFloat(v)] as [number, number]),
        asks: (data.asks as string[][]).slice(0, depth).map(([p, v]) => [parseFloat(p), parseFloat(v)] as [number, number]),
        ts:   Date.now(),
      };
    });
  }

  async fetchFundingRate(_symbol: string): Promise<FundingRate> {
    // Coinbase spot exchange — no funding rates
    return { symbol: _symbol, rate: 0, nextFundingTime: 0 };
  }

  async fetchOpenInterest(_symbol: string): Promise<OpenInterest> {
    // Coinbase spot — no OI data
    return { symbol: _symbol, openInterest: 0, ts: Date.now() };
  }
}
