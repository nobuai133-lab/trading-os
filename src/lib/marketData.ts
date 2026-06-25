import { logger } from './logger';

export interface OHLCVBar {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const BASE = 'https://fapi.binance.com';

const TF_MAP: Record<string, string> = {
  '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1H': '1h', '4H': '4h', '1D': '1d', '1W': '1w',
};

export async function fetchOHLCV(
  symbol: string,
  timeframe: string,
  limit = 200,
): Promise<OHLCVBar[]> {
  const interval = TF_MAP[timeframe] ?? timeframe.toLowerCase();
  const url = `${BASE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`Binance klines error ${res.status}: ${await res.text()}`);
  }

  const raw: unknown[][] = await res.json();
  return raw.map((r) => ({
    openTime: Number(r[0]),
    open:     parseFloat(r[1] as string),
    high:     parseFloat(r[2] as string),
    low:      parseFloat(r[3] as string),
    close:    parseFloat(r[4] as string),
    volume:   parseFloat(r[5] as string),
  }));
}

export async function fetchCurrentPrice(symbol: string): Promise<number> {
  const url = `${BASE}/fapi/v1/ticker/price?symbol=${symbol}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`Binance price error ${res.status}`);
  }
  const data: { price: string } = await res.json();
  const price = parseFloat(data.price);
  logger.debug('fetchCurrentPrice', { symbol, price });
  return price;
}
