import type { OHLCVBar } from './marketData';

export type Regime = 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'UNKNOWN';

export interface StrategyResult {
  price: number;
  open: number;
  high: number;
  low: number;
  regime: Regime;
  ema20: number;
  ema50: number;
  atr: number;
}

function ema(bars: OHLCVBar[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = bars[0].close;
  for (const b of bars) {
    prev = b.close * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function atr(bars: OHLCVBar[], period = 14): number {
  if (bars.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const prev = bars[i - 1].close;
    trs.push(Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, v) => a + v, 0) / slice.length;
}

function detectRegime(bars: OHLCVBar[], e20: number[], e50: number[]): Regime {
  if (bars.length < 50) return 'UNKNOWN';
  const last = bars.length - 1;
  const cur20 = e20[last];
  const cur50 = e50[last];
  const prev20 = e20[last - 5];
  const prev50 = e50[last - 5];

  const rising20 = cur20 > prev20;
  const rising50 = cur50 > prev50;
  const bull = cur20 > cur50;
  const bear = cur20 < cur50;

  if (bull && rising20 && rising50) return 'TRENDING_UP';
  if (bear && !rising20 && !rising50) return 'TRENDING_DOWN';
  return 'RANGING';
}

export function runStrategyAnalysis(bars: OHLCVBar[]): StrategyResult {
  if (bars.length === 0) throw new Error('No bars provided');

  const e20 = ema(bars, 20);
  const e50 = ema(bars, 50);
  const atrVal = atr(bars);
  const last = bars[bars.length - 1];
  const regime = detectRegime(bars, e20, e50);

  return {
    price:  last.close,
    open:   last.open,
    high:   last.high,
    low:    last.low,
    regime,
    ema20:  e20[e20.length - 1],
    ema50:  e50[e50.length - 1],
    atr:    atrVal,
  };
}
