import { BaseProvider } from './BaseProvider';
import type { OHLCVBar, Ticker, OrderBook, FundingRate, OpenInterest } from '../types';

const BASE = 'https://api.kraken.com/0/public';

const HEADERS = {
  Accept:       'application/json',
  'User-Agent': 'trading-os/1.0',
};

const TF_MAP: Record<string, number> = {
  '1m':  1,   '5m':  5,   '15m': 15,  '30m': 30,
  '1H':  60,  '4H':  240, '1D':  1440, '1W': 10080,
};

const SYMBOL_MAP: Record<string, string> = {
  BTCUSDT: 'XBTUSDT', ETHUSDT: 'ETHUSDT',
  BTCUSD:  'XBTUSD',  ETHUSD:  'ETHUSD',
  SOLUSD:  'SOLUSD',  SOLUSDT: 'SOLUSDT',
};

function toPair(symbol: string): string {
  return SYMBOL_MAP[symbol.toUpperCase()] ?? symbol;
}

export class KrakenProvider extends BaseProvider {
  readonly name     = 'kraken';
  readonly priority = 6;

  async fetchOHLCV(symbol: string, timeframe: string, limit = 200): Promise<OHLCVBar[]> {
    return this.timed(async () => {
      const pair     = toPair(symbol);
      const interval = TF_MAP[timeframe] ?? 240;
      const res      = await fetch(`${BASE}/OHLC?pair=${pair}&interval=${interval}`, { cache: 'no-store', headers: HEADERS });
      if (!res.ok) throw new Error(`Kraken OHLC ${res.status}`);

      const json = await res.json();
      if (json.error?.length) throw new Error(`Kraken: ${json.error[0]}`);

      const key = Object.keys(json.result).find((k) => k !== 'last');
      if (!key) throw new Error('Kraken: no data key');

      const rows: (string | number)[][] = json.result[key];
      return rows.slice(-limit).map((r) => ({
        openTime: Number(r[0]) * 1000,
        open:     parseFloat(String(r[1])),
        high:     parseFloat(String(r[2])),
        low:      parseFloat(String(r[3])),
        close:    parseFloat(String(r[4])),
        volume:   parseFloat(String(r[6])),
      }));
    });
  }

  async fetchTicker(symbol: string): Promise<Ticker> {
    return this.timed(async () => {
      const pair = toPair(symbol);
      const res  = await fetch(`${BASE}/Ticker?pair=${pair}`, { cache: 'no-store', headers: HEADERS });
      if (!res.ok) throw new Error(`Kraken ticker ${res.status}`);

      const json = await res.json();
      if (json.error?.length) throw new Error(`Kraken: ${json.error[0]}`);

      const key  = Object.keys(json.result)[0];
      const data = json.result[key];
      return {
        symbol,
        bid:       parseFloat(data.b[0]),
        ask:       parseFloat(data.a[0]),
        last:      parseFloat(data.c[0]),
        volume24h: parseFloat(data.v[1]),
        ts:        Date.now(),
      };
    });
  }

  async fetchOrderBook(symbol: string, depth = 10): Promise<OrderBook> {
    return this.timed(async () => {
      const pair = toPair(symbol);
      const res  = await fetch(`${BASE}/Depth?pair=${pair}&count=${depth}`, { cache: 'no-store', headers: HEADERS });
      if (!res.ok) throw new Error(`Kraken depth ${res.status}`);

      const json = await res.json();
      if (json.error?.length) throw new Error(`Kraken: ${json.error[0]}`);

      const key  = Object.keys(json.result)[0];
      const data = json.result[key];
      return {
        symbol,
        bids: (data.bids as string[][]).map(([p, v]) => [parseFloat(p), parseFloat(v)] as [number, number]),
        asks: (data.asks as string[][]).map(([p, v]) => [parseFloat(p), parseFloat(v)] as [number, number]),
        ts:   Date.now(),
      };
    });
  }

  async fetchFundingRate(_symbol: string): Promise<FundingRate> {
    // Kraken spot does not have funding rates
    return { symbol: _symbol, rate: 0, nextFundingTime: 0 };
  }

  async fetchOpenInterest(_symbol: string): Promise<OpenInterest> {
    // Kraken spot does not expose OI
    return { symbol: _symbol, openInterest: 0, ts: Date.now() };
  }
}
