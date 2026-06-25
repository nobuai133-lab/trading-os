import { BaseProvider } from './BaseProvider';
import type { OHLCVBar, Ticker, OrderBook, FundingRate, OpenInterest } from '../types';

const BASE = 'https://api.gateio.ws/api/v4/futures/usdt';

const HEADERS = {
  Accept:       'application/json',
  'User-Agent': 'trading-os/1.0',
};

const TF_MAP: Record<string, string> = {
  '1m': '1m',  '5m': '5m',  '15m': '15m', '30m': '30m',
  '1H': '1h',  '4H': '4h',  '1D':  '1d',  '1W':  '7d',
};

// BTCUSDT → BTC_USDT  (Gate.io futures use underscore-separated contract names)
function toContract(symbol: string): string {
  const s = symbol.toUpperCase().replace('USDT', '').replace('USD', '');
  return `${s}_USDT`;
}

interface GateioCandleRow {
  t:  number;  // open time in seconds
  o:  string;  // open
  h:  string;  // high
  l:  string;  // low
  c:  string;  // close
  v:  string;  // volume (contracts)
  sum?: string; // turnover (USDT)
}

export class GateioPerpProvider extends BaseProvider {
  readonly name       = 'gateio-perp';
  readonly priority   = 1;
  readonly priceBasis = 'PERP' as const;

  async fetchOHLCV(symbol: string, timeframe: string, limit = 200): Promise<OHLCVBar[]> {
    return this.timed(async () => {
      const contract = toContract(symbol);
      const interval = TF_MAP[timeframe] ?? '4h';
      const url      = `${BASE}/candlesticks?contract=${contract}&interval=${interval}&limit=${limit}`;
      const res      = await fetch(url, { cache: 'no-store', headers: HEADERS });
      if (!res.ok) throw new Error(`Gate.io OHLCV ${res.status}`);

      const rows: GateioCandleRow[] = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('Gate.io: empty candle response');

      return rows.map((r) => ({
        openTime: Number(r.t) * 1000,
        open:     parseFloat(r.o),
        high:     parseFloat(r.h),
        low:      parseFloat(r.l),
        close:    parseFloat(r.c),
        volume:   parseFloat(r.v),
      }));
    });
  }

  async fetchTicker(symbol: string): Promise<Ticker> {
    return this.timed(async () => {
      const contract = toContract(symbol);
      const res      = await fetch(`${BASE}/tickers?contract=${contract}`, { cache: 'no-store', headers: HEADERS });
      if (!res.ok) throw new Error(`Gate.io ticker ${res.status}`);

      const data: Array<Record<string, string>> = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('Gate.io: empty ticker response');

      const t = data[0];
      return {
        symbol,
        bid:       parseFloat(t.highest_bid ?? t.last),
        ask:       parseFloat(t.lowest_ask  ?? t.last),
        last:      parseFloat(t.last),
        volume24h: parseFloat(t.volume_24h_base ?? t.volume_24h ?? '0'),
        ts:        Date.now(),
      };
    });
  }

  async fetchOrderBook(symbol: string, depth = 10): Promise<OrderBook> {
    return this.timed(async () => {
      const contract = toContract(symbol);
      const res      = await fetch(`${BASE}/order_book?contract=${contract}&limit=${depth}`, { cache: 'no-store', headers: HEADERS });
      if (!res.ok) throw new Error(`Gate.io orderbook ${res.status}`);

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
      const contract = toContract(symbol);
      const res      = await fetch(`${BASE}/funding_rate?contract=${contract}&limit=1`, { cache: 'no-store', headers: HEADERS });
      if (!res.ok) throw new Error(`Gate.io funding ${res.status}`);

      const rows: Array<{ r: string; t: number }> = await res.json();
      const f = rows[0];
      return {
        symbol,
        rate:            parseFloat(f?.r ?? '0'),
        nextFundingTime: (f?.t ?? 0) + 28800,
      };
    });
  }

  async fetchOpenInterest(symbol: string): Promise<OpenInterest> {
    return this.timed(async () => {
      const contract = toContract(symbol);
      const res      = await fetch(`${BASE}/tickers?contract=${contract}`, { cache: 'no-store', headers: HEADERS });
      if (!res.ok) throw new Error(`Gate.io OI ${res.status}`);

      const data: Array<Record<string, string>> = await res.json();
      const t = data[0];
      return {
        symbol,
        openInterest: parseFloat(t?.open_interest ?? '0'),
        ts:           Date.now(),
      };
    });
  }
}
