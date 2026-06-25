import { describe, it, expect } from 'vitest';
import { rankSetup } from '../setupPriorityEngine';
import type { SetupPriorityInput } from '../setupPriorityEngine';

function base(overrides: Partial<SetupPriorityInput> = {}): SetupPriorityInput {
  return {
    intent:            'TREND_CONTINUATION',
    trendAlignment:    'ALIGNED',
    validity:          'VALID',
    blocked:           false,
    confidenceCap:     100,
    decayedConfidence: 75,
    zoneQualityScore:  70,
    remainingLifePct:  80,
    satisfiedCount:    0,
    requiredCount:     0,
    ...overrides,
  };
}

describe('rankSetup', () => {

  // PR-01: TREND_CONTINUATION + ALIGNED + VALID → PRIMARY
  it('PR-01: trend continuation aligned valid → PRIMARY', () => {
    const r = rankSetup(base());
    expect(r.tier).toBe('PRIMARY');
    expect(r.institutionalClass).toMatch(/^A/);
  });

  // PR-02: INVALID intent → INVALID tier
  it('PR-02: INVALID intent → INVALID tier', () => {
    const r = rankSetup(base({ intent: 'INVALID', validity: 'INVALID' }));
    expect(r.tier).toBe('INVALID');
    expect(r.institutionalClass).toBe('D');
    expect(r.riskMultiplier).toBe(0);
  });

  // PR-03: blocked CONFLICT → WATCHLIST tier
  it('PR-03: blocked CONFLICT setup → WATCHLIST', () => {
    const r = rankSetup(base({
      intent:         'REVERSAL',
      trendAlignment: 'CONFLICT',
      validity:       'WATCH_ONLY',
      blocked:        true,
    }));
    expect(r.tier).toBe('WATCHLIST');
  });

  // PR-04: WATCH_ONLY (unblocked) → at most SECONDARY
  it('PR-04: WATCH_ONLY unblocked → SECONDARY', () => {
    const r = rankSetup(base({
      intent:         'COUNTER_TREND',
      trendAlignment: 'COUNTER_TREND',
      validity:       'WATCH_ONLY',
      blocked:        false,
    }));
    expect(r.tier).toBe('SECONDARY');
  });

  // PR-05: EXPIRED → INVALID tier
  it('PR-05: EXPIRED validity → INVALID tier', () => {
    const r = rankSetup(base({ validity: 'EXPIRED', remainingLifePct: 0 }));
    expect(r.tier).toBe('INVALID');
  });

  // PR-06: priority score is in [0, 100]
  it('PR-06: priorityScore is always in [0, 100]', () => {
    const r = rankSetup(base());
    expect(r.priorityScore).toBeGreaterThanOrEqual(0);
    expect(r.priorityScore).toBeLessThanOrEqual(100);
  });

  // PR-07: riskMultiplier matches intent
  it('PR-07: riskMultiplier matches TREND_CONTINUATION rate (1.0)', () => {
    const r = rankSetup(base());
    expect(r.riskMultiplier).toBe(1.0);
  });

  // PR-08: REVERSAL intent has lower priority score than TREND_CONTINUATION
  it('PR-08: REVERSAL setup scores lower than TREND_CONTINUATION setup', () => {
    const trend   = rankSetup(base());
    const reversal = rankSetup(base({
      intent:         'REVERSAL',
      trendAlignment: 'CONFLICT',
      validity:       'WATCH_ONLY',
      blocked:        false,
    }));
    expect(trend.priorityScore).toBeGreaterThan(reversal.priorityScore);
  });

});
