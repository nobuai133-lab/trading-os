import { logger } from './logger';

export interface OHLCVBar {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const BASE = 'https://api.bybit.com';

// Bybit linear (USDT perpetual) intervals
const TF_MAP: Record<string, string> = {
  '1m':  '1',
  '5m':  '5',
  '15m': '15',
  '30m': '30',
  '1H':  '60',
  '4H':  '240',
  '1D':  'D',
  '1W':  'W',
};

export async function fetchOHLCV(
  symbol: string,
  timeframe: string,
  limit = 200,
): Promise<OHLCVBar[]> {
  const interval = TF_MAP[timeframe] ?? '240';
  const url = `${BASE}/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Bybit klines error ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (json.retCode !== 0) {
    throw new Error(`Bybit API error: ${json.retMsg}`);
  }

  // Bybit returns newest first — reverse to get chronological order
  const list: string[][] = json.result.list;
  return list.reverse().map((r) => ({
    openTime: Number(r[0]),
    open:     parseFloat(r[1]),
    high:     parseFloat(r[2]),
    low:      parseFloat(r[3]),
    close:    parseFloat(r[4]),
    volume:   parseFloat(r[5]),
  }));
}

export async function fetchCurrentPrice(symbol: string): Promise<number> {
  const url = `${BASE}/v5/market/tickers?category=linear&symbol=${symbol}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Bybit ticker error ${res.status}`);
  }
  const json = await res.json();
  if (json.retCode !== 0) {
    throw new Error(`Bybit API error: ${json.retMsg}`);
  }
  const price = parseFloat(json.result.list[0].lastPrice);
  logger.debug('fetchCurrentPrice', { symbol, price });
  return price;
}
