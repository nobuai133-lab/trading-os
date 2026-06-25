import type { OHLCVBar, ValidationResult, ValidationWarning } from './types';

const MAX_PRICE_DEVIATION = 0.20; // 20% bar-to-bar spike
const MAX_VOLUME_Z        = 5;    // z-score threshold for volume anomaly
const CLOCK_DRIFT_MS      = 30_000;
const STALE_THRESHOLD_MS  = 5 * 60_000;

export function validateOHLCV(bars: OHLCVBar[], timeframeMs: number): ValidationResult {
  const warnings: ValidationWarning[] = [];

  if (bars.length === 0) {
    return { valid: false, bars, warnings: [{ type: 'GAP_DETECTED', severity: 'high', detail: 'No bars returned' }] };
  }

  // 1. Timestamp ordering
  for (let i = 1; i < bars.length; i++) {
    if (bars[i].openTime <= bars[i - 1].openTime) {
      warnings.push({ type: 'TIMESTAMP_ORDER', severity: 'high', detail: `Bar ${i} openTime not ascending`, barIndex: i });
    }
  }

  // 2. Duplicate candles
  const seen = new Set<number>();
  for (let i = 0; i < bars.length; i++) {
    if (seen.has(bars[i].openTime)) {
      warnings.push({ type: 'DUPLICATE_CANDLE', severity: 'medium', detail: `Duplicate openTime ${bars[i].openTime}`, barIndex: i });
    }
    seen.add(bars[i].openTime);
  }

  // 3. Missing candles (gap detection)
  for (let i = 1; i < bars.length; i++) {
    const expected = bars[i - 1].openTime + timeframeMs;
    const actual   = bars[i].openTime;
    // Allow up to 1.5× the interval before flagging
    if (actual > expected + timeframeMs * 0.5) {
      const missing = Math.round((actual - expected) / timeframeMs);
      warnings.push({ type: 'MISSING_CANDLES', severity: 'medium', detail: `~${missing} missing candle(s) between bar ${i - 1} and ${i}`, barIndex: i });
    }
  }

  // 4. Price deviation (spike detection)
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].close;
    const curr = bars[i].close;
    if (prev > 0 && Math.abs(curr - prev) / prev > MAX_PRICE_DEVIATION) {
      warnings.push({ type: 'PRICE_DEVIATION', severity: 'high', detail: `${((Math.abs(curr - prev) / prev) * 100).toFixed(1)}% move at bar ${i}`, barIndex: i });
    }
  }

  // 5. Volume anomaly (z-score)
  const volumes  = bars.map((b) => b.volume);
  const volMean  = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const volStd   = Math.sqrt(volumes.reduce((s, v) => s + (v - volMean) ** 2, 0) / volumes.length);
  if (volStd > 0) {
    for (let i = 0; i < bars.length; i++) {
      const z = Math.abs(bars[i].volume - volMean) / volStd;
      if (z > MAX_VOLUME_Z) {
        warnings.push({ type: 'VOLUME_ANOMALY', severity: 'low', detail: `Volume z-score ${z.toFixed(1)} at bar ${i}`, barIndex: i });
      }
    }
  }

  // 6. Clock drift (last bar vs wall clock)
  const last      = bars[bars.length - 1];
  const drift     = Math.abs(Date.now() - (last.openTime + timeframeMs));
  if (drift > CLOCK_DRIFT_MS + timeframeMs * 2) {
    warnings.push({ type: 'CLOCK_DRIFT', severity: 'medium', detail: `Last bar ${drift}ms from expected open time` });
  }

  // 7. Stale data (last candle's close time vs now)
  const expectedClose = last.openTime + timeframeMs;
  if (Date.now() - expectedClose > STALE_THRESHOLD_MS + timeframeMs) {
    warnings.push({ type: 'STALE_DATA', severity: 'medium', detail: `Data is ${Math.round((Date.now() - expectedClose) / 60000)}m stale` });
  }

  // 8. OHLC sanity (high >= open/close, low <= open/close)
  for (let i = 0; i < bars.length; i++) {
    const { open, high, low, close } = bars[i];
    if (high < open || high < close || low > open || low > close) {
      warnings.push({ type: 'PRICE_DEVIATION', severity: 'high', detail: `OHLC sanity fail at bar ${i}`, barIndex: i });
    }
  }

  const highSeverity = warnings.filter((w) => w.severity === 'high').length;
  return {
    valid:    highSeverity === 0,
    bars,
    warnings,
  };
}

export function timeframeToMs(timeframe: string): number {
  const map: Record<string, number> = {
    '1m':  60_000,
    '5m':  300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1H':  3_600_000,
    '4H':  14_400_000,
    '1D':  86_400_000,
    '1W':  604_800_000,
  };
  return map[timeframe] ?? 14_400_000;
}
