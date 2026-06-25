import { describe, it, expect } from 'vitest';
import { generateFingerprint }  from '../memoryFingerprint';
import type {
  EvidenceState, StrategyState, TradeState, MemoryState,
} from '@/kernel/types';

function makeEvidence(overrides: Partial<EvidenceState> = {}): EvidenceState {
  return {
    correlationId: 'cid_test',
    symbol:        'BTCUSDT',
    grade:         'A',
    confidence:    80,
    lastUpdated:   new Date().toISOString(),
    stateVersion:  1n,
    categories: [
      { name: 'Market Structure', score: 20, present: true },
      { name: 'Range Context',    score: 20, present: true },
      { name: 'Liquidity',        score: 20, present: true },
      { name: 'Risk / Reward',    score: 20, present: true },
      { name: 'Regime Alignment', score: 20, present: true },
    ],
    ...overrides,
  };
}

function makeStrategy(overrides: Partial<StrategyState> = {}): StrategyState {
  return {
    symbol:       'BTCUSDT',
    timeframe:    '4H',
    regime:       'TRENDING_UP',
    ema20:        65000,
    ema50:        63000,
    atr:          1200,
    confidence:   80,
    htfBias:      'Bullish',
    ltfBias:      'Bullish',
    keyLevels:    [],
    lastAnalyzed: new Date().toISOString(),
    stateVersion: 1n,
    ...overrides,
  };
}

function makeTrade(overrides: Partial<TradeState> = {}): TradeState {
  return {
    phase:        'SETUP_DETECTED',
    tp1Hit: false, tp2Hit: false, tp3Hit: false,
    stateVersion: 1n,
    direction:    'LONG',
    entry:        64000,
    sl:           62000,
    tp1:          68000,
    tp2:          71000,
    tp3:          75000,
    riskPct:      1.5,
    timeframe:    '4H',
    ...overrides,
  };
}

function makeMemory(overrides: Partial<MemoryState> = {}): MemoryState {
  return {
    rangeMemory: {
      rangeId: 'range_1', status: 'ACTIVE',
      rangeHigh: 66000, rangeLow: 62000,
      freshLiquidity: true, reentryAllowed: true, tradeCount: 0,
    },
    fingerprint:  null,
    cooldown:     { active: false, remainingBars: 0, totalBars: 0 },
    blocked:      false,
    nextRequired: [],
    stateVersion: 1n,
    ...overrides,
  };
}

describe('generateFingerprint', () => {
  it('TC-FP01 — determinism: same inputs produce same hash', () => {
    const a = generateFingerprint(makeEvidence(), makeStrategy(), makeTrade(), makeMemory(), 'Kraken');
    const b = generateFingerprint(makeEvidence(), makeStrategy(), makeTrade(), makeMemory(), 'Kraken');
    expect(a.hash).toBe(b.hash);
  });

  it('TC-FP02 — LONG Bull trend produces BULL trend + ALIGNED ema', () => {
    const fp = generateFingerprint(makeEvidence(), makeStrategy(), makeTrade(), makeMemory(), 'Kraken');
    expect(fp.trend).toBe('BULL');
    expect(fp.emaAlignment).toBe('ALIGNED');
    expect(fp.direction).toBe('LONG');
    expect(fp.htfBias).toBe('BULL');
    expect(fp.ltfBias).toBe('BULL');
  });

  it('TC-FP03 — SHORT Bear trend produces BEAR + opposite EMA alignment', () => {
    const fp = generateFingerprint(
      makeEvidence(),
      makeStrategy({ regime: 'TRENDING_DOWN', ema20: 63000, ema50: 65000, htfBias: 'Bearish', ltfBias: 'Bearish' }),
      makeTrade({ direction: 'SHORT' }),
      makeMemory(),
      'Kraken',
    );
    expect(fp.trend).toBe('BEAR');
    expect(fp.emaAlignment).toBe('ALIGNED');
    expect(fp.direction).toBe('SHORT');
    expect(fp.htfBias).toBe('BEAR');
  });

  it('TC-FP04 — different direction changes hash', () => {
    const fpLong  = generateFingerprint(makeEvidence(), makeStrategy(), makeTrade({ direction: 'LONG' }),  makeMemory(), 'Kraken');
    const fpShort = generateFingerprint(makeEvidence(), makeStrategy(), makeTrade({ direction: 'SHORT' }), makeMemory(), 'Kraken');
    expect(fpLong.hash).not.toBe(fpShort.hash);
  });

  it('TC-FP05 — RR bucket classification', () => {
    // entry=64000, sl=62000 → distance=2000
    // HIGH: tp1=68000 → rr=4000/2000=2.0
    // MEDIUM: tp1=67000 → rr=3000/2000=1.5
    // LOW: tp1=65000 → rr=1000/2000=0.5
    const fpHigh   = generateFingerprint(makeEvidence(), makeStrategy(), makeTrade({ entry: 64000, sl: 62000, tp1: 68000 }), makeMemory(), 'Kraken');
    const fpMedium = generateFingerprint(makeEvidence(), makeStrategy(), makeTrade({ entry: 64000, sl: 62000, tp1: 67000 }), makeMemory(), 'Kraken');
    const fpLow    = generateFingerprint(makeEvidence(), makeStrategy(), makeTrade({ entry: 64000, sl: 62000, tp1: 65000 }), makeMemory(), 'Kraken');
    expect(fpHigh.rrBucket).toBe('HIGH');
    expect(fpMedium.rrBucket).toBe('MEDIUM');
    expect(fpLow.rrBucket).toBe('LOW');
  });

  it('TC-FP06 — momentum classification from EMA spread', () => {
    const fpStrong = generateFingerprint(makeEvidence(), makeStrategy({ ema20: 68000, ema50: 63000 }), makeTrade(), makeMemory(), 'Kraken');
    const fpWeak   = generateFingerprint(makeEvidence(), makeStrategy({ ema20: 63100, ema50: 63000 }), makeTrade(), makeMemory(), 'Kraken');
    expect(fpStrong.momentum).toBe('STRONG'); // spread = 7.9%
    expect(fpWeak.momentum).toBe('WEAK');     // spread = 0.16%
  });

  it('TC-FP07 — Liquidity category maps to liquiditySweep', () => {
    const fpWith    = generateFingerprint(makeEvidence(), makeStrategy(), makeTrade(), makeMemory(), 'Kraken');
    const fpWithout = generateFingerprint(
      makeEvidence({
        categories: [
          { name: 'Liquidity', score: 0, present: false },
        ],
      }),
      makeStrategy(), makeTrade(), makeMemory(), 'Kraken',
    );
    expect(fpWith.liquiditySweep).toBe(true);
    expect(fpWithout.liquiditySweep).toBe(false);
  });

  it('TC-FP08 — volume is always UNAVAILABLE in v1', () => {
    const fp = generateFingerprint(makeEvidence(), makeStrategy(), makeTrade(), makeMemory(), 'Kraken');
    expect(fp.volume).toBe('UNAVAILABLE');
  });
});
