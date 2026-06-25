import { describe, it, expect } from 'vitest';
import { validateCounterTrend } from '../counterTrendValidator';
import type { CounterTrendValidatorInput } from '../counterTrendValidator';

function base(overrides: Partial<CounterTrendValidatorInput> = {}): CounterTrendValidatorInput {
  return {
    intent:             'REVERSAL',
    direction:          'LONG',
    trendAlignment:     'CONFLICT',
    entryZoneSource:    'DEMAND_ZONE',
    zoneQualityScore:   70,
    decayedConfidence:  60,
    remainingLifePct:   50,
    liquidityEvidence:  false,
    structureEvidence:  false,
    acceptanceEvidence: false,
    momentumEvidence:   false,
    volumeEvidence:     false,
    ...overrides,
  };
}

describe('validateCounterTrend', () => {

  // CT-01: no evidence + REVERSAL → not approved
  it('CT-01: no evidence flags → not approved (REVERSAL requires 6)', () => {
    const r = validateCounterTrend(base());
    expect(r.approved).toBe(false);
    expect(r.confirmationCount).toBe(0);
    expect(r.missingConfirmations.length).toBeGreaterThan(0);
  });

  // CT-02: all evidence + good quality → approved for REVERSAL
  it('CT-02: all 5 evidence flags + good quality → REVERSAL approved', () => {
    const r = validateCounterTrend(base({
      liquidityEvidence:  true,
      structureEvidence:  true,
      acceptanceEvidence: true,
      momentumEvidence:   true,
      volumeEvidence:     true,
    }));
    expect(r.approved).toBe(true);
    expect(r.confirmationCount).toBeGreaterThanOrEqual(5);
  });

  // CT-03: COUNTER_TREND requires only 4 confirmations (lower bar)
  it('CT-03: COUNTER_TREND with 4 evidence flags → approved', () => {
    const r = validateCounterTrend(base({
      intent:            'COUNTER_TREND',
      trendAlignment:    'COUNTER_TREND',
      liquidityEvidence: true,
      structureEvidence: true,
      acceptanceEvidence: true,
      momentumEvidence:  true,
    }));
    expect(r.approved).toBe(true);
    expect(r.minimumRequired).toBe(4);
  });

  // CT-04: REVERSAL with 4 evidence flags → NOT approved (needs 6)
  it('CT-04: REVERSAL with only 4 evidence flags → not approved', () => {
    const r = validateCounterTrend(base({
      liquidityEvidence: true,
      structureEvidence: true,
      acceptanceEvidence: true,
      momentumEvidence:  true,
    }));
    expect(r.approved).toBe(false);
    expect(r.minimumRequired).toBe(6);
  });

  // CT-05: institutional gate failure (low zone quality) → not approved
  it('CT-05: all evidence but low zone quality → not approved', () => {
    const r = validateCounterTrend(base({
      liquidityEvidence:  true,
      structureEvidence:  true,
      acceptanceEvidence: true,
      momentumEvidence:   true,
      volumeEvidence:     true,
      zoneQualityScore:   10,  // below MIN_ZONE_QUALITY_REVERSAL (50)
    }));
    expect(r.approved).toBe(false);
    expect(r.reason).toContain('institutional quality gates failed');
  });

  // CT-06: UNKNOWN source → institutional check fails
  it('CT-06: UNKNOWN entry zone source → institutional gate fails', () => {
    const r = validateCounterTrend(base({
      entryZoneSource:    'UNKNOWN',
      liquidityEvidence:  true,
      structureEvidence:  true,
      acceptanceEvidence: true,
      momentumEvidence:   true,
      volumeEvidence:     true,
    }));
    expect(r.approved).toBe(false);
    expect(r.reason).toContain('institutional quality gates failed');
  });

  // CT-07: requiredConfirmations always has 10 items (6 + 4 institutional)
  it('CT-07: requiredConfirmations always has 10 items', () => {
    const r = validateCounterTrend(base());
    expect(r.requiredConfirmations.length).toBe(10);
  });

});
