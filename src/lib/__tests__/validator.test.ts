import { describe, it, expect } from 'vitest';
import { validateOHLCV, timeframeToMs } from '../marketData/validator';
import type { OHLCVBar } from '../marketData/types';

function makeBar(openTime: number, close: number, overrides: Partial<OHLCVBar> = {}): OHLCVBar {
  return { openTime, open: close, high: close * 1.001, low: close * 0.999, close, volume: 100, ...overrides };
}

const TF_MS = 14_400_000; // 4H

describe('validateOHLCV', () => {
  it('passes valid sequential bars', () => {
    const bars: OHLCVBar[] = [
      makeBar(0,         30000),
      makeBar(TF_MS,     30100),
      makeBar(TF_MS * 2, 30200),
    ];
    const result = validateOHLCV(bars, TF_MS);
    expect(result.valid).toBe(true);
    expect(result.warnings.filter((w) => w.severity === 'high')).toHaveLength(0);
  });

  it('returns invalid with empty bars', () => {
    const result = validateOHLCV([], TF_MS);
    expect(result.valid).toBe(false);
    expect(result.warnings[0].type).toBe('GAP_DETECTED');
  });

  it('detects timestamp order violation', () => {
    const bars: OHLCVBar[] = [
      makeBar(TF_MS * 2, 30000),
      makeBar(TF_MS,     30000), // out of order
    ];
    const result = validateOHLCV(bars, TF_MS);
    expect(result.warnings.some((w) => w.type === 'TIMESTAMP_ORDER')).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('detects large price deviation', () => {
    const bars: OHLCVBar[] = [
      makeBar(0,     30000),
      makeBar(TF_MS, 40000), // 33% spike — above 20% threshold
    ];
    const result = validateOHLCV(bars, TF_MS);
    expect(result.warnings.some((w) => w.type === 'PRICE_DEVIATION')).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('detects duplicate candles', () => {
    const bars: OHLCVBar[] = [
      makeBar(0, 30000),
      makeBar(0, 30000), // duplicate
    ];
    const result = validateOHLCV(bars, TF_MS);
    expect(result.warnings.some((w) => w.type === 'DUPLICATE_CANDLE')).toBe(true);
  });

  it('detects OHLC sanity failure (high < close)', () => {
    const bar = makeBar(0, 30000, { high: 29000 }); // high < close — invalid
    const result = validateOHLCV([bar], TF_MS);
    expect(result.warnings.some((w) => w.type === 'PRICE_DEVIATION')).toBe(true);
    expect(result.valid).toBe(false);
  });
});

describe('timeframeToMs', () => {
  it('converts known timeframes correctly', () => {
    expect(timeframeToMs('1m')).toBe(60_000);
    expect(timeframeToMs('4H')).toBe(14_400_000);
    expect(timeframeToMs('1D')).toBe(86_400_000);
  });

  it('defaults to 4H for unknown timeframe', () => {
    expect(timeframeToMs('3H')).toBe(14_400_000);
  });
});
