import { logger } from './logger';

export interface OHLCVBar {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const BASE = 'https://api.kraken.com/0/public';

const FETCH_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'trading-os/1.0',
};

// Kraken interval in minutes
const TF_MAP: Record<string, number> = {
  '1m':  1,
  '5m':  5,
  '15m': 15,
  '30m': 30,
  '1H':  60,
  '4H':  240,
  '1D':  1440,
  '1W':  10080,
};

// Map common symbol formats to Kraken pair names
const SYMBOL_MAP: Record<string, string> = {
  'BTCUSDT':  'XBTUSDT',
  'ETHUSDT':  'ETHUSDT',
  'BTCUSD':   'XBTUSD',
  'ETHUSD':   'ETHUSD',
  'SOLUSD':   'SOLUSD',
  'SOLUSDT':  'SOLUSDT',
};

function toKrakenPair(symbol: string): string {
  return SYMBOL_MAP[symbol.toUpperCase()] ?? symbol;
}

export async function fetchOHLCV(
  symbol: string,
  timeframe: string,
  limit = 200,
): Promise<OHLCVBar[]> {
  const pair     = toKrakenPair(symbol);
  const interval = TF_MAP[timeframe] ?? 240;
  const url      = `${BASE}/OHLC?pair=${pair}&interval=${interval}`;

  const res = await fetch(url, { cache: 'no-store', headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`Kraken OHLC error ${res.status}`);

  const json = await res.json();
  if (json.error?.length) throw new Error(`Kraken error: ${json.error[0]}`);

  // Result key varies (e.g. XBTUSDT, XXBTZUSD) — take first non-"last" key
  const key = Object.keys(json.result).find((k) => k !== 'last');
  if (!key) throw new Error('Kraken: no data key in response');

  const rows: (string | number)[][] = json.result[key];
  // Kraken returns oldest first; take last `limit` bars
  const slice = rows.slice(-limit);

  return slice.map((r) => ({
    openTime: Number(r[0]) * 1000,
    open:     parseFloat(String(r[1])),
    high:     parseFloat(String(r[2])),
    low:      parseFloat(String(r[3])),
    close:    parseFloat(String(r[4])),
    volume:   parseFloat(String(r[6])),
  }));
}

export async function fetchCurrentPrice(symbol: string): Promise<number> {
  const pair = toKrakenPair(symbol);
  const url  = `${BASE}/Ticker?pair=${pair}`;

  const res = await fetch(url, { cache: 'no-store', headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`Kraken ticker error ${res.status}`);

  const json = await res.json();
  if (json.error?.length) throw new Error(`Kraken error: ${json.error[0]}`);

  const key   = Object.keys(json.result)[0];
  const price = parseFloat(json.result[key].c[0]); // c = last trade closed [price, lot volume]
  logger.debug('fetchCurrentPrice', { symbol, pair, price });
  return price;
}
