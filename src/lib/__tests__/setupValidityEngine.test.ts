import { describe, it, expect } from 'vitest';
import { assessSetupValidity, applyGradeCap, REVERSAL_CONFIRMATIONS } from '../setupValidityEngine';
import type { SetupValidityInput } from '../setupValidityEngine';

const RECENT = new Date(Date.now() - 30 * 60_000).toISOString(); // 30 min ago
const OLD_4H = new Date(Date.now() - 25 * 60 * 60_000).toISOString(); // 25h ago — exceeds 4H max

function base(overrides: Partial<SetupValidityInput> = {}): SetupValidityInput {
  return {
    htfBias:      'BULLISH',
    ltfBias:      'BULLISH',
    regime:       'TRENDING_UP',
    currentPrice: 65000,
    direction:    'LONG',
    entryZoneLow:  63000,
    entryZoneHigh: 63500,
    createdAt:    RECENT,
    timeframe:    '4H',
    ...overrides,
  };
}

describe('setupValidityEngine', () => {

  // SV-01: bearish+bearish + LONG without reversal = WATCH_ONLY blocked
  it('SV-01: bearish HTF + bearish LTF + LONG = WATCH_ONLY blocked', () => {
    const r = assessSetupValidity(base({ htfBias: 'BEARISH', ltfBias: 'BEARISH' }));
    expect(r.validity).toBe('WATCH_ONLY');
    expect(r.trendAlignment).toBe('CONFLICT');
    expect(r.blocked).toBe(true);
    expect(r.actionability).toBe('WATCHING');
    expect(r.confidenceCap).toBeLessThanOrEqual(40);
    expect(r.gradeCap).toBe('C');
    expect(r.missingConfirmations.length).toBeGreaterThan(0);
  });

  // SV-02: bearish+bearish + SHORT = VALID, ALIGNED, READY
  it('SV-02: bearish HTF + bearish LTF + SHORT = VALID, ALIGNED, READY', () => {
    const r = assessSetupValidity(base({ htfBias: 'BEARISH', ltfBias: 'BEARISH', direction: 'SHORT', entryZoneLow: 64000, entryZoneHigh: 64500 }));
    expect(r.validity).toBe('VALID');
    expect(r.trendAlignment).toBe('ALIGNED');
    expect(r.actionability).toBe('READY');
    expect(r.blocked).toBe(false);
    expect(r.confidenceCap).toBe(100);
    expect(r.missingConfirmations).toHaveLength(0);
  });

  // SV-03: counter-trend LONG with all reversal confirmations = WATCH_ONLY CONFIRMATION_REQUIRED
  it('SV-03: counter-trend LONG with all reversal confirmations = WATCH_ONLY CONFIRMATION_REQUIRED', () => {
    const r = assessSetupValidity(base({
      htfBias: 'BEARISH', ltfBias: 'BEARISH',
      liquidityEvidence:   true,
      structureEvidence:   true,
      acceptanceEvidence:  true,
      momentumEvidence:    true,
      volumeEvidence:      true,
    }));
    expect(r.validity).toBe('WATCH_ONLY');
    expect(r.actionability).toBe('CONFIRMATION_REQUIRED');
    // 5 flags set → 5/6 confirmations satisfied
    expect(r.satisfiedConfirmations.length).toBeGreaterThanOrEqual(4);
  });

  // SV-04: counter-trend LONG missing confirmations = blocked
  it('SV-04: counter-trend LONG missing confirmations = blocked', () => {
    const r = assessSetupValidity(base({ htfBias: 'BEARISH', ltfBias: 'BEARISH' }));
    expect(r.blocked).toBe(true);
    expect(r.missingConfirmations.length).toBeGreaterThan(0);
  });

  // SV-05: setup age > 4H max (24h) = EXPIRED
  it('SV-05: 4H setup age > 24h = EXPIRED', () => {
    const r = assessSetupValidity(base({ createdAt: OLD_4H, timeframe: '4H' }));
    expect(r.validity).toBe('EXPIRED');
    expect(r.blocked).toBe(true);
    expect(r.actionability).toBe('INVALID');
  });

  // SV-06: DEMO_DATA entry zone source = INVALID
  it('SV-06: DEMO_DATA entry zone source = INVALID', () => {
    const r = assessSetupValidity(base({
      htfBias: 'BEARISH', ltfBias: 'BEARISH',
      entryZoneSource: 'DEMO_DATA',
    }));
    expect(r.validity).toBe('INVALID');
    expect(r.blocked).toBe(true);
  });

  // SV-07: entry zone must have a valid source reason
  it('SV-07: entry zone reason is always a non-empty string', () => {
    const r = assessSetupValidity(base());
    expect(typeof r.entryZoneReason).toBe('string');
    expect(r.entryZoneReason.length).toBeGreaterThan(0);
  });

  // SV-08: grade A forbidden for conflict (no confirmations)
  it('SV-08: grade A is capped to C for conflict setup without confirmations', () => {
    const r = assessSetupValidity(base({ htfBias: 'BEARISH', ltfBias: 'BEARISH', signalGrade: 'A' }));
    expect(r.gradeCap).toBe('C');
  });

  // SV-09: bullish+bullish + LONG = VALID (aligned, no grade cap)
  it('SV-09: aligned LONG is VALID with full confidence cap and no grade restriction', () => {
    const r = assessSetupValidity(base());
    expect(r.validity).toBe('VALID');
    expect(r.confidenceCap).toBe(100);
    expect(r.blocked).toBe(false);
    // gradeCap='A+' means no restriction — the ceiling is the highest possible grade
    expect(r.gradeCap).toBe('A+');
    // But the effective grade when applied to a 'B' signal stays 'B' (cap doesn't upgrade)
    expect(applyGradeCap('B', r.gradeCap)).toBe('B');
    expect(applyGradeCap('A+', r.gradeCap)).toBe('A+');
  });

  // SV-10: COUNTER_TREND (one side bullish, one bearish) for LONG = WATCH_ONLY
  it('SV-10: LONG with bearish HTF + bullish LTF = COUNTER_TREND, WATCH_ONLY', () => {
    const r = assessSetupValidity(base({ htfBias: 'BEARISH', ltfBias: 'BULLISH' }));
    expect(r.validity).toBe('WATCH_ONLY');
    expect(r.trendAlignment).toBe('COUNTER_TREND');
  });

  // SV-11: expiryTime is always a valid ISO string
  it('SV-11: expiryTime is always a valid ISO string', () => {
    const r = assessSetupValidity(base());
    expect(() => new Date(r.expiryTime)).not.toThrow();
    expect(r.expiryTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // SV-12: ageMinutes is positive integer
  it('SV-12: ageMinutes reflects time since createdAt', () => {
    const r = assessSetupValidity(base({ createdAt: new Date(Date.now() - 60 * 60_000).toISOString() }));
    expect(r.ageMinutes).toBeGreaterThan(50);
    expect(r.ageMinutes).toBeLessThan(70);
  });
});
