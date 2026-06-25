import { describe, it, expect } from 'vitest';
import { classifySetup } from '../setupClassifier';

describe('setupClassifier', () => {
  // SC-01: Aligned long
  it('SC-01: LONG with BULL HTF and BULL LTF → TREND_CONTINUATION_LONG, ALIGNED, READY', () => {
    const r = classifySetup('LONG', 'BULL', 'BULL');
    expect(r.setupType).toBe('TREND_CONTINUATION_LONG');
    expect(r.trendAlignment).toBe('ALIGNED');
    expect(r.actionability).toBe('READY');
    expect(r.missingConfirmations).toHaveLength(0);
    expect(r.satisfiedConfirmations.length).toBeGreaterThan(0);
  });

  // SC-02: Full conflict long (both bearish)
  it('SC-02: LONG with BEAR HTF and BEAR LTF → COUNTER_TREND_REVERSAL_LONG, CONFLICT, CONFIRMATION_REQUIRED', () => {
    const r = classifySetup('LONG', 'BEAR', 'BEAR');
    expect(r.setupType).toBe('COUNTER_TREND_REVERSAL_LONG');
    expect(r.trendAlignment).toBe('CONFLICT');
    expect(r.actionability).toBe('CONFIRMATION_REQUIRED');
    expect(r.satisfiedConfirmations).toHaveLength(0);
    expect(r.missingConfirmations.length).toBeGreaterThan(0);
    expect(r.reason).toMatch(/counter-trend/i);
  });

  // SC-03: Aligned short
  it('SC-03: SHORT with BEAR HTF and BEAR LTF → TREND_CONTINUATION_SHORT, ALIGNED, READY', () => {
    const r = classifySetup('SHORT', 'BEAR', 'BEAR');
    expect(r.setupType).toBe('TREND_CONTINUATION_SHORT');
    expect(r.trendAlignment).toBe('ALIGNED');
    expect(r.actionability).toBe('READY');
    expect(r.missingConfirmations).toHaveLength(0);
  });

  // SC-04: Counter-trend short (both bullish)
  it('SC-04: SHORT with BULL HTF and BULL LTF → COUNTER_TREND_REVERSAL_SHORT, CONFLICT, CONFIRMATION_REQUIRED', () => {
    const r = classifySetup('SHORT', 'BULL', 'BULL');
    expect(r.setupType).toBe('COUNTER_TREND_REVERSAL_SHORT');
    expect(r.trendAlignment).toBe('CONFLICT');
    expect(r.actionability).toBe('CONFIRMATION_REQUIRED');
    expect(r.satisfiedConfirmations).toHaveLength(0);
    expect(r.missingConfirmations.length).toBeGreaterThan(0);
  });

  // SC-05: LONG with bullish HTF but bearish LTF (pullback retest)
  it('SC-05: LONG with BULL HTF and BEAR LTF → RETEST_LONG, COUNTER_TREND, WATCHING', () => {
    const r = classifySetup('LONG', 'BULL', 'BEAR');
    expect(r.setupType).toBe('RETEST_LONG');
    expect(r.trendAlignment).toBe('COUNTER_TREND');
    expect(r.actionability).toBe('WATCHING');
  });

  // SC-06: SHORT with bearish HTF but bullish LTF (pullback retest)
  it('SC-06: SHORT with BEAR HTF and BULL LTF → RETEST_SHORT, COUNTER_TREND, WATCHING', () => {
    const r = classifySetup('SHORT', 'BEAR', 'BULL');
    expect(r.setupType).toBe('RETEST_SHORT');
    expect(r.trendAlignment).toBe('COUNTER_TREND');
    expect(r.actionability).toBe('WATCHING');
  });

  // SC-07: LONG with bearish HTF but bullish LTF
  it('SC-07: LONG with BEAR HTF and BULL LTF → COUNTER_TREND_REVERSAL_LONG, COUNTER_TREND', () => {
    const r = classifySetup('LONG', 'BEAR', 'BULL');
    expect(r.setupType).toBe('COUNTER_TREND_REVERSAL_LONG');
    expect(r.trendAlignment).toBe('COUNTER_TREND');
    expect(r.actionability).toBe('CONFIRMATION_REQUIRED');
    // LTF shift satisfied
    expect(r.satisfiedConfirmations).toHaveLength(1);
    expect(r.missingConfirmations.length).toBeGreaterThan(0);
  });

  // SC-08: result always has all required fields
  it('SC-08: result shape is always complete', () => {
    const r = classifySetup('LONG', 'NEUTRAL', 'NEUTRAL');
    expect(r).toHaveProperty('setupType');
    expect(r).toHaveProperty('trendAlignment');
    expect(r).toHaveProperty('actionability');
    expect(r).toHaveProperty('requiredConfirmations');
    expect(r).toHaveProperty('satisfiedConfirmations');
    expect(r).toHaveProperty('missingConfirmations');
    expect(r).toHaveProperty('reason');
    expect(typeof r.reason).toBe('string');
  });
});
