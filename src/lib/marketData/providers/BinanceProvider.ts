import { BaseProvider } from './BaseProvider';
import type { OHLCVBar, Ticker, OrderBook, FundingRate, OpenInterest } from '../types';

const BASE = 'https://api.binance.com/api/v3';
const FAPI = 'https://fapi.binance.com/fapi/v1';

const TF_MAP: Record<string, string> = {
  '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1H': '1h', '4H': '4h', '1D':  '1d',  '1W':  '1w',
};

export class BinanceProvider extends BaseProvider {
  readonly name     = 'binance';
  readonly priority = 1;

  // Geo-blocked on Railway US — starts unavailable, health-check promotes it
  protected override available = false;

  async fetchOHLCV(symbol: string, timeframe: string, limit = 200): Promise<OHLCVBar[]> {
    return this.timed(async () => {
      const interval = TF_MAP[timeframe] ?? '4h';
      const res = await fetch(`${BASE}/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`);
      if (!res.ok) throw new Error(`Binance OHLC ${res.status}`);

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
      const [book, price] = await Promise.all([
        fetch(`${BASE}/ticker/bookTicker?symbol=${symbol.toUpperCase()}`).then((r) => r.json()),
        fetch(`${BASE}/ticker/24hr?symbol=${symbol.toUpperCase()}`).then((r) => r.json()),
      ]);
      return {
        symbol,
        bid:       parseFloat(book.bidPrice),
        ask:       parseFloat(book.askPrice),
        last:      parseFloat(price.lastPrice),
        volume24h: parseFloat(price.volume),
        ts:        Date.now(),
      };
    });
  }

  async fetchOrderBook(symbol: string, depth = 10): Promise<OrderBook> {
    return this.timed(async () => {
      const res = await fetch(`${BASE}/depth?symbol=${symbol.toUpperCase()}&limit=${depth}`);
      if (!res.ok) throw new Error(`Binance depth ${res.status}`);
      const data = await res.json();
      return {
        symbol,
        bids: (data.bids as string[][]).map(([p, v]) => [parseFloat(p), parseFloat(v)] as [number, number]),
        asks: (data.asks as string[][]).map(([p, v]) => [parseFloat(p), parseFloat(v)] as [number, number]),
        ts:   Date.now(),
      };
    });
  }

  async fetchFundingRate(symbol: string): Promise<FundingRate> {
    return this.timed(async () => {
      const res = await fetch(`${FAPI}/premiumIndex?symbol=${symbol.toUpperCase()}`);
      if (!res.ok) throw new Error(`Binance funding ${res.status}`);
      const data = await res.json();
      return {
        symbol,
        rate:            parseFloat(data.lastFundingRate),
        nextFundingTime: Number(data.nextFundingTime),
      };
    });
  }

  async fetchOpenInterest(symbol: string): Promise<OpenInterest> {
    return this.timed(async () => {
      const res = await fetch(`${FAPI}/openInterest?symbol=${symbol.toUpperCase()}`);
      if (!res.ok) throw new Error(`Binance OI ${res.status}`);
      const data = await res.json();
      return {
        symbol,
        openInterest: parseFloat(data.openInterest),
        ts:           Date.now(),
      };
    });
  }
}
