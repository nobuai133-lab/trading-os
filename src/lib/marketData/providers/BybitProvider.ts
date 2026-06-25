import { BaseProvider } from './BaseProvider';
import type { OHLCVBar, Ticker, OrderBook, FundingRate, OpenInterest } from '../types';

const BASE = 'https://api.bybit.com/v5';

const TF_MAP: Record<string, string> = {
  '1m': '1', '5m': '5', '15m': '15', '30m': '30',
  '1H': '60', '4H': '240', '1D': 'D', '1W': 'W',
};

export class BybitProvider extends BaseProvider {
  readonly name       = 'bybit';
  readonly priority   = 3;
  readonly priceBasis = 'PERP' as const; // linear perpetual (category=linear)

  async fetchOHLCV(symbol: string, timeframe: string, limit = 200): Promise<OHLCVBar[]> {
    return this.timed(async () => {
      const interval = TF_MAP[timeframe] ?? '240';
      const res = await fetch(`${BASE}/market/kline?category=linear&symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`);
      if (!res.ok) throw new Error(`Bybit OHLC ${res.status}`);

      const json = await res.json();
      if (json.retCode !== 0) throw new Error(`Bybit: ${json.retMsg}`);

      // Bybit returns newest first — reverse for oldest-first order
      const rows: string[][] = (json.result.list as string[][]).slice().reverse();
      return rows.map((r) => ({
        openTime: Number(r[0]),
        open:     parseFloat(r[1]),
        high:     parseFloat(r[2]),
        low:      parseFloat(r[3]),
        close:    parseFloat(r[4]),
        volume:   parseFloat(r[5]),
      }));
    });
  }

  async fetchTicker(symbol: string): Promise<Ticker> {
    return this.timed(async () => {
      const res = await fetch(`${BASE}/market/tickers?category=linear&symbol=${symbol.toUpperCase()}`);
      if (!res.ok) throw new Error(`Bybit ticker ${res.status}`);
      const json = await res.json();
      if (json.retCode !== 0) throw new Error(`Bybit: ${json.retMsg}`);
      const t = json.result.list[0];
      return {
        symbol,
        bid:       parseFloat(t.bid1Price),
        ask:       parseFloat(t.ask1Price),
        last:      parseFloat(t.lastPrice),
        volume24h: parseFloat(t.volume24h),
        ts:        Date.now(),
      };
    });
  }

  async fetchOrderBook(symbol: string, depth = 10): Promise<OrderBook> {
    return this.timed(async () => {
      const res = await fetch(`${BASE}/market/orderbook?category=linear&symbol=${symbol.toUpperCase()}&limit=${depth}`);
      if (!res.ok) throw new Error(`Bybit orderbook ${res.status}`);
      const json = await res.json();
      if (json.retCode !== 0) throw new Error(`Bybit: ${json.retMsg}`);
      const data = json.result;
      return {
        symbol,
        bids: (data.b as string[][]).map(([p, v]) => [parseFloat(p), parseFloat(v)] as [number, number]),
        asks: (data.a as string[][]).map(([p, v]) => [parseFloat(p), parseFloat(v)] as [number, number]),
        ts:   Date.now(),
      };
    });
  }

  async fetchFundingRate(symbol: string): Promise<FundingRate> {
    return this.timed(async () => {
      const res = await fetch(`${BASE}/market/funding/history?category=linear&symbol=${symbol.toUpperCase()}&limit=1`);
      if (!res.ok) throw new Error(`Bybit funding ${res.status}`);
      const json = await res.json();
      if (json.retCode !== 0) throw new Error(`Bybit: ${json.retMsg}`);
      const f = json.result.list[0];
      return {
        symbol,
        rate:            parseFloat(f.fundingRate),
        nextFundingTime: Number(f.fundingRateTimestamp) + 28800000,
      };
    });
  }

  async fetchOpenInterest(symbol: string): Promise<OpenInterest> {
    return this.timed(async () => {
      const res = await fetch(`${BASE}/market/open-interest?category=linear&symbol=${symbol.toUpperCase()}&intervalTime=1h&limit=1`);
      if (!res.ok) throw new Error(`Bybit OI ${res.status}`);
      const json = await res.json();
      if (json.retCode !== 0) throw new Error(`Bybit: ${json.retMsg}`);
      const oi = json.result.list[0];
      return {
        symbol,
        openInterest: parseFloat(oi.openInterest),
        ts:           Number(oi.timestamp),
      };
    });
  }
}
