import type { OHLCVBar } from './marketData';

export type Regime = 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'UNKNOWN';

export interface SwingPoint {
  index:    number;
  price:    number;
  type:     'HIGH' | 'LOW';
  openTime: number;
}

export interface KeyLevelResult {
  price:     number;
  type:      'RESISTANCE' | 'SUPPORT' | 'LIQUIDITY_HIGH' | 'LIQUIDITY_LOW';
  strength:  number;
  timeframe: string;
  source:    'SWING' | 'LIQUIDITY';
}

export interface RangeResult {
  high:       number;
  low:        number;
  midline:    number;
  width:      number;
  touchCount: number;
}

export interface StrategyResult {
  price:      number;
  open:       number;
  high:       number;
  low:        number;
  regime:     Regime;
  ema20:      number;
  ema50:      number;
  atr:        number;
  swings:     SwingPoint[];
  keyLevels:  KeyLevelResult[];
  ranges:     RangeResult[];
  confidence: number;
  htfBias:    string;
}

// ── EMA ───────────────────────────────────────────────────────────────────────

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

// ── ATR ───────────────────────────────────────────────────────────────────────

function atr(bars: OHLCVBar[], period = 14): number {
  if (bars.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b    = bars[i];
    const prev = bars[i - 1].close;
    trs.push(Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, v) => a + v, 0) / slice.length;
}

// ── Regime ────────────────────────────────────────────────────────────────────

function detectRegime(bars: OHLCVBar[], e20: number[], e50: number[]): Regime {
  if (bars.length < 50) return 'UNKNOWN';
  const last    = bars.length - 1;
  const cur20   = e20[last];
  const cur50   = e50[last];
  const prev20  = e20[last - 5];
  const prev50  = e50[last - 5];
  const rising20 = cur20 > prev20;
  const rising50 = cur50 > prev50;
  if (cur20 > cur50 && rising20 && rising50) return 'TRENDING_UP';
  if (cur20 < cur50 && !rising20 && !rising50) return 'TRENDING_DOWN';
  return 'RANGING';
}

// ── Swing detection ───────────────────────────────────────────────────────────

export function detectSwings(bars: OHLCVBar[], lookback = 5): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    const bar = bars[i];

    let isHigh = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && bars[j].high >= bar.high) { isHigh = false; break; }
    }
    if (isHigh) swings.push({ index: i, price: bar.high, type: 'HIGH', openTime: bar.openTime });

    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && bars[j].low <= bar.low) { isLow = false; break; }
    }
    if (isLow) swings.push({ index: i, price: bar.low, type: 'LOW', openTime: bar.openTime });
  }
  return swings;
}

// ── Key level clustering ──────────────────────────────────────────────────────

export function findKeyLevels(
  swings: SwingPoint[],
  currentPrice: number,
  timeframe: string,
  tolerance = 0.005,
): KeyLevelResult[] {
  const cluster = (prices: number[]): { price: number; count: number }[] => {
    const clusters: { price: number; count: number }[] = [];
    for (const price of prices) {
      const hit = clusters.find((c) => Math.abs(c.price - price) / price < tolerance);
      if (hit) { hit.price = (hit.price + price) / 2; hit.count++; }
      else      clusters.push({ price, count: 1 });
    }
    return clusters.sort((a, b) => b.count - a.count).slice(0, 8);
  };

  const highs = cluster(swings.filter((s) => s.type === 'HIGH').map((s) => s.price));
  const lows  = cluster(swings.filter((s) => s.type === 'LOW').map((s) => s.price));

  const levels: KeyLevelResult[] = [
    ...highs.map((c) => ({
      price:     c.price,
      type:      (c.price > currentPrice ? 'RESISTANCE' : 'SUPPORT') as 'RESISTANCE' | 'SUPPORT',
      strength:  c.count,
      timeframe,
      source:    'SWING' as const,
    })),
    ...lows.map((c) => ({
      price:     c.price,
      type:      (c.price < currentPrice ? 'SUPPORT' : 'RESISTANCE') as 'RESISTANCE' | 'SUPPORT',
      strength:  c.count,
      timeframe,
      source:    'SWING' as const,
    })),
  ];

  return levels
    .sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))
    .slice(0, 10);
}

// ── Liquidity zones (equal highs/lows) ───────────────────────────────────────

export function detectLiquidityZones(
  swings: SwingPoint[],
  timeframe: string,
  tolerance = 0.003,
): KeyLevelResult[] {
  const zones: KeyLevelResult[] = [];

  const findEqual = (
    points: SwingPoint[],
    type: 'LIQUIDITY_HIGH' | 'LIQUIDITY_LOW',
  ) => {
    for (let i = 0; i < points.length; i++) {
      const nearby = points.filter(
        (p, j) => j !== i && Math.abs(p.price - points[i].price) / points[i].price < tolerance,
      );
      if (nearby.length >= 1) {
        const avg = (points[i].price + nearby.reduce((s, p) => s + p.price, 0)) / (nearby.length + 1);
        if (!zones.find((z) => Math.abs(z.price - avg) / avg < tolerance * 2)) {
          zones.push({ price: avg, type, strength: nearby.length + 1, timeframe, source: 'LIQUIDITY' });
        }
      }
    }
  };

  findEqual(swings.filter((s) => s.type === 'HIGH'), 'LIQUIDITY_HIGH');
  findEqual(swings.filter((s) => s.type === 'LOW'),  'LIQUIDITY_LOW');

  return zones;
}

// ── Range detection ───────────────────────────────────────────────────────────

export function detectRanges(swings: SwingPoint[], tolerance = 0.02): RangeResult[] {
  const highs = swings.filter((s) => s.type === 'HIGH').slice(-15);
  const lows  = swings.filter((s) => s.type === 'LOW').slice(-15);
  const ranges: RangeResult[] = [];

  for (const high of highs) {
    for (const low of lows) {
      if (high.price <= low.price) continue;
      const width = (high.price - low.price) / low.price;
      if (width < tolerance || width > 0.20) continue;

      const hTouches = highs.filter((h) => Math.abs(h.price - high.price) / high.price < tolerance / 2).length;
      const lTouches = lows.filter((l) =>  Math.abs(l.price - low.price)  / low.price  < tolerance / 2).length;

      if (hTouches >= 2 || lTouches >= 2) {
        const exists = ranges.find(
          (r) => Math.abs(r.high - high.price) / high.price < tolerance &&
                 Math.abs(r.low  - low.price)  / low.price  < tolerance,
        );
        if (!exists) {
          ranges.push({
            high:       high.price,
            low:        low.price,
            midline:    (high.price + low.price) / 2,
            width:      high.price - low.price,
            touchCount: hTouches + lTouches,
          });
        }
      }
    }
  }

  return ranges.sort((a, b) => b.touchCount - a.touchCount).slice(0, 5);
}

// ── Confidence score ──────────────────────────────────────────────────────────

export function computeConfidence(
  regime: Regime,
  e20: number[],
  e50: number[],
  swings: SwingPoint[],
): number {
  let score = 0;

  // Regime clarity (0-35)
  if (regime !== 'UNKNOWN') score += 15;
  if (regime === 'TRENDING_UP' || regime === 'TRENDING_DOWN') score += 20;

  // EMA separation (0-35)
  const last    = e20.length - 1;
  const emaDiff = Math.abs(e20[last] - e50[last]) / e50[last];
  if (emaDiff > 0.02)  score += 35;
  else if (emaDiff > 0.01)  score += 22;
  else if (emaDiff > 0.005) score += 10;

  // Structure quality (0-30)
  const recent = swings.slice(-20).length;
  if (recent >= 8) score += 30;
  else if (recent >= 4) score += 15;

  return Math.min(score, 100);
}

// ── HTF bias ──────────────────────────────────────────────────────────────────

export function deriveHtfBias(regime: Regime): string {
  if (regime === 'TRENDING_UP')   return 'BULLISH';
  if (regime === 'TRENDING_DOWN') return 'BEARISH';
  return 'NEUTRAL';
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function runStrategyAnalysis(bars: OHLCVBar[], timeframe = '4H'): StrategyResult {
  if (bars.length === 0) throw new Error('No bars provided');

  const e20    = ema(bars, 20);
  const e50    = ema(bars, 50);
  const atrVal = atr(bars);
  const last   = bars[bars.length - 1];
  const regime = detectRegime(bars, e20, e50);
  const swings = detectSwings(bars);

  const keyLevels = [
    ...findKeyLevels(swings, last.close, timeframe),
    ...detectLiquidityZones(swings, timeframe),
  ].sort((a, b) => Math.abs(a.price - last.close) - Math.abs(b.price - last.close)).slice(0, 12);

  const ranges     = detectRanges(swings);
  const confidence = computeConfidence(regime, e20, e50, swings);

  return {
    price:      last.close,
    open:       last.open,
    high:       last.high,
    low:        last.low,
    regime,
    ema20:      e20[e20.length - 1],
    ema50:      e50[e50.length - 1],
    atr:        atrVal,
    swings,
    keyLevels,
    ranges,
    confidence,
    htfBias:    deriveHtfBias(regime),
  };
}
