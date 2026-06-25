import { describe, it, expect } from 'vitest';
import { classifySetupIntent, INTENT_RISK_MULTIPLIER, INTENT_RANK } from '../setupIntentEngine';
import type { SetupIntentInput } from '../setupIntentEngine';

function base(overrides: Partial<SetupIntentInput> = {}): SetupIntentInput {
  return {
    direction:       'LONG',
    htfBias:         'BULLISH',
    ltfBias:         'BULLISH',
    regime:          'TRENDING_UP',
    entryZoneSource: 'UNKNOWN',
    trendAlignment:  'ALIGNED',
    ...overrides,
  };
}

describe('classifySetupIntent', () => {

  // IT-01: DEMO_DATA → INVALID regardless of alignment
  it('IT-01: DEMO_DATA → INVALID', () => {
    const r = classifySetupIntent(base({ entryZoneSource: 'DEMO_DATA' }));
    expect(r.intent).toBe('INVALID');
    expect(r.riskMultiplier).toBe(0);
  });

  // IT-02: liquidity sweep reclaim → LIQUIDITY_SWEEP
  it('IT-02: LIQUIDITY_SWEEP_RECLAIM → LIQUIDITY_SWEEP', () => {
    const r = classifySetupIntent(base({ entryZoneSource: 'LIQUIDITY_SWEEP_RECLAIM' }));
    expect(r.intent).toBe('LIQUIDITY_SWEEP');
    expect(r.riskMultiplier).toBe(0.60);
  });

  // IT-03: RANGING regime → RANGE_REVERSION
  it('IT-03: RANGING regime → RANGE_REVERSION', () => {
    const r = classifySetupIntent(base({ regime: 'RANGING', trendAlignment: 'ALIGNED' }));
    expect(r.intent).toBe('RANGE_REVERSION');
  });

  // IT-04: ACCUMULATION regime → RANGE_REVERSION
  it('IT-04: ACCUMULATION regime → RANGE_REVERSION', () => {
    const r = classifySetupIntent(base({ regime: 'ACCUMULATION', trendAlignment: 'ALIGNED' }));
    expect(r.intent).toBe('RANGE_REVERSION');
  });

  // IT-05: ALIGNED + RETEST_BREAKOUT → BREAKOUT_CONTINUATION
  it('IT-05: ALIGNED + RETEST_BREAKOUT → BREAKOUT_CONTINUATION', () => {
    const r = classifySetupIntent(base({ entryZoneSource: 'RETEST_BREAKOUT', trendAlignment: 'ALIGNED' }));
    expect(r.intent).toBe('BREAKOUT_CONTINUATION');
    expect(r.riskMultiplier).toBe(0.90);
  });

  // IT-06: ALIGNED + RETEST_BREAKDOWN → BREAKDOWN_CONTINUATION
  it('IT-06: ALIGNED + RETEST_BREAKDOWN → BREAKDOWN_CONTINUATION', () => {
    const r = classifySetupIntent(base({
      direction: 'SHORT', entryZoneSource: 'RETEST_BREAKDOWN', trendAlignment: 'ALIGNED',
    }));
    expect(r.intent).toBe('BREAKDOWN_CONTINUATION');
  });

  // IT-07: ALIGNED + DEMAND_ZONE → RETEST_CONTINUATION
  it('IT-07: ALIGNED + DEMAND_ZONE → RETEST_CONTINUATION', () => {
    const r = classifySetupIntent(base({ entryZoneSource: 'DEMAND_ZONE', trendAlignment: 'ALIGNED' }));
    expect(r.intent).toBe('RETEST_CONTINUATION');
    expect(r.riskMultiplier).toBe(0.85);
  });

  // IT-08: ALIGNED + SUPPLY_ZONE → RETEST_CONTINUATION
  it('IT-08: ALIGNED + SUPPLY_ZONE → RETEST_CONTINUATION', () => {
    const r = classifySetupIntent(base({ entryZoneSource: 'SUPPLY_ZONE', trendAlignment: 'ALIGNED' }));
    expect(r.intent).toBe('RETEST_CONTINUATION');
  });

  // IT-09: ALIGNED + UNKNOWN → TREND_CONTINUATION
  it('IT-09: ALIGNED + UNKNOWN → TREND_CONTINUATION', () => {
    const r = classifySetupIntent(base({ entryZoneSource: 'UNKNOWN', trendAlignment: 'ALIGNED' }));
    expect(r.intent).toBe('TREND_CONTINUATION');
    expect(r.riskMultiplier).toBe(1.0);
  });

  // IT-10: COUNTER_TREND alignment → COUNTER_TREND intent
  it('IT-10: COUNTER_TREND alignment → COUNTER_TREND intent', () => {
    const r = classifySetupIntent(base({ trendAlignment: 'COUNTER_TREND' }));
    expect(r.intent).toBe('COUNTER_TREND');
    expect(r.riskMultiplier).toBe(0.30);
  });

  // IT-11: CONFLICT alignment → REVERSAL intent
  it('IT-11: CONFLICT alignment → REVERSAL intent', () => {
    const r = classifySetupIntent(base({ trendAlignment: 'CONFLICT' }));
    expect(r.intent).toBe('REVERSAL');
    expect(r.riskMultiplier).toBe(0.50);
  });

  // IT-12: risk multiplier ordering — TREND_CONTINUATION > REVERSAL > COUNTER_TREND
  it('IT-12: risk multipliers decrease for riskier intents', () => {
    expect(INTENT_RISK_MULTIPLIER.TREND_CONTINUATION).toBeGreaterThan(INTENT_RISK_MULTIPLIER.REVERSAL);
    expect(INTENT_RISK_MULTIPLIER.REVERSAL).toBeGreaterThan(INTENT_RISK_MULTIPLIER.COUNTER_TREND);
    expect(INTENT_RISK_MULTIPLIER.COUNTER_TREND).toBeGreaterThan(INTENT_RISK_MULTIPLIER.INVALID);
    expect(INTENT_RISK_MULTIPLIER.INVALID).toBe(0);
  });

  // IT-13: INTENT_RANK — TREND_CONTINUATION has lowest rank (highest priority)
  it('IT-13: TREND_CONTINUATION has lowest rank number (highest priority)', () => {
    expect(INTENT_RANK.TREND_CONTINUATION).toBeLessThan(INTENT_RANK.COUNTER_TREND);
    expect(INTENT_RANK.COUNTER_TREND).toBeLessThan(INTENT_RANK.INVALID);
  });

  // IT-14: reason string is always non-empty
  it('IT-14: reason is always a non-empty string', () => {
    const r = classifySetupIntent(base());
    expect(typeof r.reason).toBe('string');
    expect(r.reason.length).toBeGreaterThan(0);
  });

});
