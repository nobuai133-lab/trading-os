import { BaseProvider } from './BaseProvider';
import type { OHLCVBar, Ticker, OrderBook, FundingRate, OpenInterest } from '../types';

// Binance Futures REST API — separate from spot (api.binance.com).
// fapi.binance.com may be accessible from Railway US even when spot is geo-blocked.
const FAPI = 'https://fapi.binance.com/fapi/v1';

const TF_MAP: Record<string, string> = {
  '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1H': '1h', '4H': '4h', '1D':  '1d',  '1W':  '1w',
};

export class BinanceFuturesProvider extends BaseProvider {
  readonly name       = 'binance-futures';
  readonly priority   = 2;
  readonly priceBasis = 'PERP' as const;

  async fetchOHLCV(symbol: string, timeframe: string, limit = 200): Promise<OHLCVBar[]> {
    return this.timed(async () => {
      const interval = TF_MAP[timeframe] ?? '4h';
      const res = await fetch(`${FAPI}/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Binance Futures OHLCV ${res.status}`);

      const rows: (string | number)[][] = await res.json();
      return rows.map((r) => ({
        openTime: Number(r[0]),
        open:     parseFloat(String(r[1])),
        high:     parseFloat(String(r[2])),
        low:      parseFloat(String(r[3])),
        close:    parseFloat(String(r[4])),
        volume:   parseFloat(String(r[5])),
      }));
    });
  }

  async fetchTicker(symbol: string): Promise<Ticker> {
    return this.timed(async () => {
      const res = await fetch(`${FAPI}/ticker/24hr?symbol=${symbol.toUpperCase()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Binance Futures ticker ${res.status}`);

      const data = await res.json() as Record<string, string>;
      return {
        symbol,
        bid:       parseFloat(data.bidPrice  ?? data.lastPrice),
        ask:       parseFloat(data.askPrice  ?? data.lastPrice),
        last:      parseFloat(data.lastPrice),
        volume24h: parseFloat(data.volume),
        ts:        Date.now(),
      };
    });
  }

  async fetchOrderBook(symbol: string, depth = 10): Promise<OrderBook> {
    return this.timed(async () => {
      const res = await fetch(`${FAPI}/depth?symbol=${symbol.toUpperCase()}&limit=${depth}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Binance Futures depth ${res.status}`);

      const data = await res.json() as { bids: string[][]; asks: string[][] };
      return {
        symbol,
        bids: (data.bids ?? []).map(([p, v]) => [parseFloat(p), parseFloat(v)] as [number, number]),
        asks: (data.asks ?? []).map(([p, v]) => [parseFloat(p), parseFloat(v)] as [number, number]),
        ts:   Date.now(),
      };
    });
  }

  async fetchFundingRate(symbol: string): Promise<FundingRate> {
    return this.timed(async () => {
      const res = await fetch(`${FAPI}/premiumIndex?symbol=${symbol.toUpperCase()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Binance Futures funding ${res.status}`);

      const data = await res.json() as Record<string, string | number>;
      return {
        symbol,
        rate:            parseFloat(String(data.lastFundingRate ?? 0)),
        nextFundingTime: Number(data.nextFundingTime ?? 0),
      };
    });
  }

  async fetchOpenInterest(symbol: string): Promise<OpenInterest> {
    return this.timed(async () => {
      const res = await fetch(`${FAPI}/openInterest?symbol=${symbol.toUpperCase()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Binance Futures OI ${res.status}`);

      const data = await res.json() as Record<string, string>;
      return {
        symbol,
        openInterest: parseFloat(data.openInterest ?? '0'),
        ts:           Date.now(),
      };
    });
  }
}
