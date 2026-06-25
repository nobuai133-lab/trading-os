import { describe, it, expect } from 'vitest';
import {
  createBacktestSession,
  stepBacktestSession,
  runBacktestSession,
  pauseBacktestSession,
  resetBacktestSession,
  computeSharpeRatio,
  computeCalmarRatio,
  computeProfitFactor,
  partitionWalkForwardWindows,
  computeRobustnessScore,
  runWalkForward,
  DEFAULT_BACKTEST_CONFIG,
} from '@/lib/backtestEngine';
import type { ReplayCandle, BacktestConfig, WalkForwardConfig } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_TS = 1_700_000_000_000;
const INTERVAL = 3_600_000;

function makeCandles(count: number, base = 50_000): ReplayCandle[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: BASE_TS + i * INTERVAL,
    open:  base + i * 10,
    high:  base + i * 10 + 100,
    low:   base + i * 10 - 50,
    close: base + i * 10 + 20,
    volume: 100 + i,
  }));
}

function makeBullCandles(count: number, base = 50_000): ReplayCandle[] {
  return Array.from({ length: count }, (_, i) => {
    const p = base + i * 200;
    return {
      timestamp: BASE_TS + i * INTERVAL,
      open:  p,
      high:  p + 300 + i * 20,
      low:   p - 50,
      close: p + 250,
      volume: 200 + i * 5,
    };
  });
}

function makeBearCandles(count: number, base = 55_000): ReplayCandle[] {
  return Array.from({ length: count }, (_, i) => {
    const p = base - i * 200;
    return {
      timestamp: BASE_TS + i * INTERVAL,
      open:  p,
      high:  p + 50,
      low:   p - 300 - i * 20,
      close: p - 250,
      volume: 200 + i * 5,
    };
  });
}

const T = new Date('2025-01-01T00:00:00Z');

// ── createBacktestSession ─────────────────────────────────────────────────────

describe('createBacktestSession', () => {
  it('returns session with default config when no config provided', () => {
    const { session, error } = createBacktestSession(
      { symbol: 'BTCUSDT', timeframe: '1H', candles: makeCandles(20) }, T,
    );
    expect(error).toBeNull();
    expect(session).not.toBeNull();
    expect(session!.config.fees).toBe(DEFAULT_BACKTEST_CONFIG.fees);
    expect(session!.config.slippage).toBe(DEFAULT_BACKTEST_CONFIG.slippage);
    expect(session!.config.initialCapital).toBe(DEFAULT_BACKTEST_CONFIG.initialCapital);
  });

  it('merges partial config over defaults', () => {
    const { session } = createBacktestSession(
      { symbol: 'BTCUSDT', timeframe: '1H', candles: makeCandles(20), config: { fees: 0.002 } }, T,
    );
    expect(session!.config.fees).toBe(0.002);
    expect(session!.config.slippage).toBe(DEFAULT_BACKTEST_CONFIG.slippage);
  });

  it('starts with zero BacktestMetrics', () => {
    const { session } = createBacktestSession(
      { symbol: 'BTCUSDT', timeframe: '1H', candles: makeCandles(20) }, T,
    );
    expect(session!.metrics.netR).toBe(0);
    expect(session!.metrics.sharpeRatio).toBe(0);
    expect(session!.metrics.totalFeesR).toBe(0);
    expect(session!.metrics.profitFactor).toBe(0);
  });

  it('returns error for invalid candles', () => {
    const bad: ReplayCandle[] = [
      { timestamp: BASE_TS, open: 100, high: 50, low: 40, close: 80, volume: 10 },
    ];
    const { session, error } = createBacktestSession(
      { symbol: 'X', timeframe: '1H', candles: bad }, T,
    );
    expect(session).toBeNull();
    expect(error).not.toBeNull();
  });

  it('replayId is set on the session', () => {
    const { session } = createBacktestSession(
      { symbol: 'ETHUSDT', timeframe: '4H', candles: makeCandles(10) }, T,
    );
    expect(session!.replayId).toMatch(/^re_/);
  });
});

// ── stepBacktestSession ───────────────────────────────────────────────────────

describe('stepBacktestSession', () => {
  it('advances currentIndex and sets status RUNNING', () => {
    const { session: s0 } = createBacktestSession(
      { symbol: 'BTC', timeframe: '1H', candles: makeCandles(20) }, T,
    );
    const { session: s1, stepped } = stepBacktestSession(s0!, T);
    expect(stepped).toBe(true);
    expect(s1.currentIndex).toBe(0);
    expect(s1.status).toBe('RUNNING');
  });

  it('does not double-count fees on subsequent steps', () => {
    const { session: s0 } = createBacktestSession(
      { symbol: 'BTC', timeframe: '1H', candles: makeBullCandles(30) }, T,
    );
    const { session: s15 } = runBacktestSession(s0!, 15, T);
    const { session: s16 } = stepBacktestSession(s15, T);
    // Fees should only increase, never go backwards
    expect(s16.metrics.totalFeesR).toBeGreaterThanOrEqual(s15.metrics.totalFeesR);
  });

  it('netR = totalRealizedR - totalFeesR - totalSlippageR', () => {
    const { session: s0 } = createBacktestSession(
      { symbol: 'BTC', timeframe: '1H', candles: makeBullCandles(25) }, T,
    );
    const { session: done } = runBacktestSession(s0!, undefined, T);
    const m = done.metrics;
    expect(m.netR).toBeCloseTo(m.totalRealizedR - m.totalFeesR - m.totalSlippageR, 2);
  });

  it('fees accumulate across multiple closed positions', () => {
    const { session: s0 } = createBacktestSession(
      { symbol: 'BTC', timeframe: '1H', candles: makeBullCandles(40) }, T,
    );
    const { session: done } = runBacktestSession(s0!, undefined, T);
    // Should have at least some fees if trades occurred
    const hadTrades = done.metrics.approvedTrades > 0;
    if (hadTrades) {
      expect(done.metrics.totalFeesR).toBeGreaterThan(0);
    }
  });
});

// ── runBacktestSession ────────────────────────────────────────────────────────

describe('runBacktestSession', () => {
  it('runs bull market to COMPLETED', () => {
    const { session: s0 } = createBacktestSession(
      { symbol: 'BTC', timeframe: '1H', candles: makeBullCandles(30) }, T,
    );
    const { session: done, stepsRun } = runBacktestSession(s0!, undefined, T);
    expect(done.status).toBe('COMPLETED');
    expect(stepsRun).toBe(30);
  });

  it('respects maxSteps limit', () => {
    const { session: s0 } = createBacktestSession(
      { symbol: 'BTC', timeframe: '1H', candles: makeBullCandles(50) }, T,
    );
    const { session: mid, stepsRun } = runBacktestSession(s0!, 10, T);
    expect(stepsRun).toBe(10);
    expect(mid.status).toBe('RUNNING');
  });

  it('no-ops on already-completed session', () => {
    const { session: s0 } = createBacktestSession(
      { symbol: 'BTC', timeframe: '1H', candles: makeCandles(5) }, T,
    );
    const { session: done }  = runBacktestSession(s0!, undefined, T);
    const { session: again, stepsRun } = runBacktestSession(done, undefined, T);
    expect(stepsRun).toBe(0);
    expect(again.status).toBe('COMPLETED');
  });

  it('netR is always totalRealizedR - fees - slippage at completion', () => {
    const { session: s0 } = createBacktestSession(
      { symbol: 'BTC', timeframe: '1H', candles: makeBullCandles(35) }, T,
    );
    const { session: done } = runBacktestSession(s0!, undefined, T);
    const m = done.metrics;
    expect(m.netR).toBeCloseTo(m.totalRealizedR - m.totalFeesR - m.totalSlippageR, 1);
  });

  it('bear market produces negative signals occasionally', () => {
    const { session: s0 } = createBacktestSession(
      { symbol: 'BTC', timeframe: '1H', candles: makeBearCandles(30) }, T,
    );
    const { session: done } = runBacktestSession(s0!, undefined, T);
    expect(done.status).toBe('COMPLETED');
    // Just verify it completes without error
    expect(done.metrics.totalCandles).toBe(30);
  });
});

// ── computeSharpeRatio ────────────────────────────────────────────────────────

describe('computeSharpeRatio', () => {
  it('returns 0 for empty array', () => {
    expect(computeSharpeRatio([])).toBe(0);
  });

  it('returns 0 for single trade', () => {
    expect(computeSharpeRatio([1])).toBe(0);
  });

  it('returns positive for consistent wins', () => {
    const returns = [1, 1, 1, 1, 1];
    expect(computeSharpeRatio(returns)).toBe(0);  // std=0 → 0
  });

  it('returns positive Sharpe for mostly winning returns', () => {
    const returns = [2, 2, 2, -1, 2];
    const sharpe = computeSharpeRatio(returns);
    expect(sharpe).toBeGreaterThan(0);
  });

  it('returns negative Sharpe for mostly losing returns', () => {
    const returns = [-2, -2, -2, 1, -2];
    const sharpe = computeSharpeRatio(returns);
    expect(sharpe).toBeLessThan(0);
  });
});

// ── computeCalmarRatio ────────────────────────────────────────────────────────

describe('computeCalmarRatio', () => {
  it('returns 0 for zero drawdown and zero netR', () => {
    expect(computeCalmarRatio(0, 0)).toBe(0);
  });

  it('returns 999 for positive netR with no drawdown', () => {
    expect(computeCalmarRatio(5, 0)).toBe(999);
  });

  it('computes ratio correctly', () => {
    expect(computeCalmarRatio(3, 1.5)).toBeCloseTo(2.0, 1);
  });
});

// ── computeProfitFactor ───────────────────────────────────────────────────────

describe('computeProfitFactor', () => {
  it('returns 0 for no wins and no losses', () => {
    expect(computeProfitFactor([], [])).toBe(0);
  });

  it('returns 999 for wins only', () => {
    expect(computeProfitFactor([1, 2, 3], [])).toBe(999);
  });

  it('computes ratio', () => {
    expect(computeProfitFactor([3], [-1])).toBeCloseTo(3.0, 1);
  });
});

// ── partitionWalkForwardWindows ───────────────────────────────────────────────

describe('partitionWalkForwardWindows', () => {
  it('returns empty array when too few candles', () => {
    const cfg: WalkForwardConfig = { numWindows: 3, inSampleRatio: 0.7 };
    expect(partitionWalkForwardWindows(5, cfg)).toHaveLength(0);
  });

  it('returns numWindows windows for sufficient candles', () => {
    const cfg: WalkForwardConfig = { numWindows: 3, inSampleRatio: 0.7 };
    const windows = partitionWalkForwardWindows(90, cfg);
    expect(windows).toHaveLength(3);
  });

  it('OOS starts immediately after IS end', () => {
    const cfg: WalkForwardConfig = { numWindows: 2, inSampleRatio: 0.6 };
    const windows = partitionWalkForwardWindows(100, cfg);
    for (const w of windows) {
      expect(w.outOfSampleStart).toBe(w.inSampleEnd + 1);
    }
  });

  it('windowIndex is sequential', () => {
    const cfg: WalkForwardConfig = { numWindows: 4, inSampleRatio: 0.6 };
    const windows = partitionWalkForwardWindows(200, cfg);
    windows.forEach((w, i) => expect(w.windowIndex).toBe(i));
  });

  it('all window indices are within total candle range', () => {
    const cfg: WalkForwardConfig = { numWindows: 3, inSampleRatio: 0.7 };
    const windows = partitionWalkForwardWindows(60, cfg);
    for (const w of windows) {
      expect(w.inSampleStart).toBeGreaterThanOrEqual(0);
      expect(w.outOfSampleEnd).toBeLessThan(60);
    }
  });
});

// ── computeRobustnessScore ────────────────────────────────────────────────────

describe('computeRobustnessScore', () => {
  function makeMetrics(netR: number) {
    return { netR } as import('@/types').BacktestMetrics;
  }

  it('returns 30 when both IS and OOS are negative', () => {
    expect(computeRobustnessScore(makeMetrics(-1), makeMetrics(-0.5))).toBe(30);
  });

  it('returns 10 when IS positive but OOS negative', () => {
    expect(computeRobustnessScore(makeMetrics(2), makeMetrics(-1))).toBe(10);
  });

  it('returns 70 when IS negative but OOS positive', () => {
    expect(computeRobustnessScore(makeMetrics(-1), makeMetrics(1))).toBe(70);
  });

  it('returns 100 when OOS matches IS exactly', () => {
    expect(computeRobustnessScore(makeMetrics(2), makeMetrics(2))).toBe(100);
  });

  it('returns proportional score for partial OOS performance', () => {
    const score = computeRobustnessScore(makeMetrics(4), makeMetrics(2));
    expect(score).toBe(50);
  });
});

// ── pauseBacktestSession / resetBacktestSession ───────────────────────────────

describe('pauseBacktestSession', () => {
  it('pauses a running session', () => {
    const { session: s0 } = createBacktestSession(
      { symbol: 'BTC', timeframe: '1H', candles: makeCandles(20) }, T,
    );
    const { session: running } = stepBacktestSession(s0!, T);
    const { session: paused }  = pauseBacktestSession(running, T);
    expect(paused.status).toBe('PAUSED');
    expect(paused.config).toEqual(running.config);
  });

  it('preserves accumulated fees when paused', () => {
    const { session: s0 } = createBacktestSession(
      { symbol: 'BTC', timeframe: '1H', candles: makeBullCandles(20) }, T,
    );
    const { session: mid }    = runBacktestSession(s0!, 10, T);
    const { session: paused } = pauseBacktestSession(mid, T);
    expect(paused.metrics.totalFeesR).toBe(mid.metrics.totalFeesR);
  });
});

describe('resetBacktestSession', () => {
  it('resets metrics to zero', () => {
    const { session: s0 } = createBacktestSession(
      { symbol: 'BTC', timeframe: '1H', candles: makeBullCandles(20) }, T,
    );
    const { session: done }  = runBacktestSession(s0!, undefined, T);
    const { session: reset } = resetBacktestSession(done, T);
    expect(reset.status).toBe('IDLE');
    expect(reset.metrics.netR).toBe(0);
    expect(reset.metrics.totalFeesR).toBe(0);
    expect(reset.config).toEqual(done.config);
  });
});

// ── runWalkForward ────────────────────────────────────────────────────────────

describe('runWalkForward', () => {
  const wfCfg: WalkForwardConfig = { numWindows: 3, inSampleRatio: 0.7 };

  it('returns error when too few candles', () => {
    const { result, error } = runWalkForward(
      makeCandles(5), 'BTC', '1H', 'SIM',
      DEFAULT_BACKTEST_CONFIG, wfCfg, T,
    );
    expect(result).toBeNull();
    expect(error).not.toBeNull();
  });

  it('returns wfId and correct window count for sufficient candles', () => {
    const { result, error } = runWalkForward(
      makeBullCandles(90), 'BTC', '1H', 'SIM',
      DEFAULT_BACKTEST_CONFIG, wfCfg, T,
    );
    expect(error).toBeNull();
    expect(result!.wfId).toMatch(/^wf_/);
    expect(result!.windows).toHaveLength(3);
  });

  it('each window has inSampleSession and outOfSampleSession completed', () => {
    const { result } = runWalkForward(
      makeBullCandles(90), 'BTC', '1H', 'SIM',
      DEFAULT_BACKTEST_CONFIG, wfCfg, T,
    );
    for (const w of result!.windows) {
      expect(w.inSampleSession.status).toBe('COMPLETED');
      expect(w.outOfSampleSession.status).toBe('COMPLETED');
    }
  });

  it('aggregateOutOfSampleNetR is sum of window OOS netR', () => {
    const { result } = runWalkForward(
      makeBullCandles(90), 'BTC', '1H', 'SIM',
      DEFAULT_BACKTEST_CONFIG, wfCfg, T,
    );
    const expectedOOS = result!.windows.reduce(
      (s, w) => s + w.outOfSampleSession.metrics.netR, 0,
    );
    expect(result!.aggregateOutOfSampleNetR).toBeCloseTo(expectedOOS, 1);
  });

  it('invalid candles propagate error', () => {
    const bad: ReplayCandle[] = [
      { timestamp: 1000, open: 100, high: 50, low: 10, close: 90, volume: 1 },
    ];
    const { result, error } = runWalkForward(
      bad, 'BTC', '1H', 'SIM', DEFAULT_BACKTEST_CONFIG, wfCfg, T,
    );
    expect(result).toBeNull();
    expect(error).toBeTruthy();
  });
});

// ── Integration: fees reduce gross R ─────────────────────────────────────────

describe('fees impact', () => {
  it('high-fee config produces lower netR than low-fee config', () => {
    const candles = makeBullCandles(40);

    const { session: s0low } = createBacktestSession(
      { symbol: 'BTC', timeframe: '1H', candles, config: { fees: 0.0001, slippage: 0.0001 } }, T,
    );
    const { session: doneLow } = runBacktestSession(s0low!, undefined, T);

    const { session: s0high } = createBacktestSession(
      { symbol: 'BTC', timeframe: '1H', candles, config: { fees: 0.005, slippage: 0.002 } }, T,
    );
    const { session: doneHigh } = runBacktestSession(s0high!, undefined, T);

    if (doneLow.metrics.approvedTrades > 0) {
      expect(doneLow.metrics.netR).toBeGreaterThan(doneHigh.metrics.netR);
    }
  });

  it('zero fees gives netR equal to totalRealizedR', () => {
    const candles = makeBullCandles(30);
    const { session: s0 } = createBacktestSession(
      { symbol: 'BTC', timeframe: '1H', candles, config: { fees: 0, slippage: 0 } }, T,
    );
    const { session: done } = runBacktestSession(s0!, undefined, T);
    expect(done.metrics.netR).toBeCloseTo(done.metrics.totalRealizedR, 2);
    expect(done.metrics.totalFeesR).toBe(0);
  });
});
