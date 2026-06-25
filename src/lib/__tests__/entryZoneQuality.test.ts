import { describe, it, expect } from 'vitest';
import { scoreEntryZoneQuality } from '../entryZoneQuality';
import type { EntryZoneQualityInput } from '../entryZoneQuality';

function base(overrides: Partial<EntryZoneQualityInput> = {}): EntryZoneQualityInput {
  return {
    entryZoneSource:    'DEMAND_ZONE',
    trendAlignment:     'ALIGNED',
    liquidityEvidence:  false,
    structureEvidence:  false,
    acceptanceEvidence: false,
    momentumEvidence:   false,
    volumeEvidence:     false,
    ageMinutes:         30,
    timeframe:          '4H',
    ...overrides,
  };
}

describe('scoreEntryZoneQuality', () => {

  // EZ-01: DEMO_DATA → INVALID (score 0)
  it('EZ-01: DEMO_DATA → INVALID (score 0)', () => {
    const r = scoreEntryZoneQuality(base({ entryZoneSource: 'DEMO_DATA' }));
    expect(r.score).toBe(0);
    expect(r.label).toBe('INVALID');
  });

  // EZ-02: ALIGNED + RETEST_BREAKOUT + all evidence flags → EXCELLENT
  it('EZ-02: best inputs → score >= 80 (EXCELLENT)', () => {
    const r = scoreEntryZoneQuality(base({
      entryZoneSource:    'RETEST_BREAKOUT',
      trendAlignment:     'ALIGNED',
      liquidityEvidence:  true,
      structureEvidence:  true,
      acceptanceEvidence: true,
      momentumEvidence:   true,
      volumeEvidence:     true,
      ageMinutes:         10,
    }));
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.label).toBe('EXCELLENT');
  });

  // EZ-03: CONFLICT alignment → alignment score 0
  it('EZ-03: CONFLICT alignment → lower score than ALIGNED', () => {
    const aligned  = scoreEntryZoneQuality(base({ trendAlignment: 'ALIGNED' }));
    const conflict = scoreEntryZoneQuality(base({ trendAlignment: 'CONFLICT' }));
    expect(aligned.score).toBeGreaterThan(conflict.score);
  });

  // EZ-04: more evidence flags → higher score
  it('EZ-04: all evidence flags increase score vs no flags', () => {
    const noFlags = scoreEntryZoneQuality(base());
    const allFlags = scoreEntryZoneQuality(base({
      liquidityEvidence: true, structureEvidence: true, acceptanceEvidence: true,
      momentumEvidence: true, volumeEvidence: true,
    }));
    expect(allFlags.score).toBeGreaterThan(noFlags.score);
  });

  // EZ-05: fresh setup scores higher than stale setup
  it('EZ-05: fresh setup scores higher than stale (90% of max age)', () => {
    const fresh = scoreEntryZoneQuality(base({ ageMinutes: 30 }));
    const stale = scoreEntryZoneQuality(base({ ageMinutes: 1300 }));  // near 1440m max
    expect(fresh.score).toBeGreaterThan(stale.score);
  });

  // EZ-06: factors array is always non-empty
  it('EZ-06: factors array is always present and non-empty', () => {
    const r = scoreEntryZoneQuality(base());
    expect(r.factors).toBeDefined();
    expect(r.factors.length).toBeGreaterThan(0);
  });

  // EZ-07: reason is always a non-empty string
  it('EZ-07: reason is always a non-empty string', () => {
    const r = scoreEntryZoneQuality(base());
    expect(typeof r.reason).toBe('string');
    expect(r.reason.length).toBeGreaterThan(0);
  });

  // EZ-08: score is between 0 and 100
  it('EZ-08: score is always in [0, 100]', () => {
    const r = scoreEntryZoneQuality(base());
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

});
