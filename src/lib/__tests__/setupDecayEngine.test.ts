import { describe, it, expect } from 'vitest';
import { computeConfidenceDecay } from '../setupDecayEngine';

const RECENT_30M  = new Date(Date.now() - 30  * 60_000).toISOString();
const RECENT_1H   = new Date(Date.now() -  1  * 60 * 60_000).toISOString();
const RECENT_12H  = new Date(Date.now() - 12  * 60 * 60_000).toISOString();
const OLD_25H     = new Date(Date.now() - 25  * 60 * 60_000).toISOString();

describe('computeConfidenceDecay', () => {

  // CD-01: fresh 4H setup has currentConfidence close to initial
  it('CD-01: fresh 4H setup (30m old) → minimal decay', () => {
    const r = computeConfidenceDecay({ initialConfidence: 75, createdAt: RECENT_30M, timeframe: '4H' });
    expect(r.currentConfidence).toBeGreaterThan(70);
    expect(r.currentConfidence).toBeLessThanOrEqual(75);
    expect(r.remainingLifePct).toBeGreaterThan(90);
  });

  // CD-02: 4H setup 12h old — significant decay
  it('CD-02: 4H setup 12h old → significant decay', () => {
    const r = computeConfidenceDecay({ initialConfidence: 75, createdAt: RECENT_12H, timeframe: '4H' });
    expect(r.currentConfidence).toBeLessThan(75);
    expect(r.remainingLifePct).toBeCloseTo(50, 5);  // 12h / 24h max = 50%
  });

  // CD-03: expired 4H setup (25h old) → confidence near 0
  it('CD-03: 4H setup > 24h old → confidence near 0', () => {
    const r = computeConfidenceDecay({ initialConfidence: 75, createdAt: OLD_25H, timeframe: '4H' });
    expect(r.currentConfidence).toBeLessThan(20);
    expect(r.remainingLifePct).toBe(0);  // clamped to 0
  });

  // CD-04: 1H setup decays faster than 4H setup at same age
  it('CD-04: 1H setup decays faster than 4H setup at same age', () => {
    const r1H = computeConfidenceDecay({ initialConfidence: 75, createdAt: RECENT_1H, timeframe: '1H' });
    const r4H = computeConfidenceDecay({ initialConfidence: 75, createdAt: RECENT_1H, timeframe: '4H' });
    expect(r1H.currentConfidence).toBeLessThan(r4H.currentConfidence);
  });

  // CD-05: ageMinutes is always >= 0
  it('CD-05: ageMinutes is non-negative', () => {
    const r = computeConfidenceDecay({ initialConfidence: 75, createdAt: RECENT_30M, timeframe: '4H' });
    expect(r.ageMinutes).toBeGreaterThanOrEqual(0);
  });

  // CD-06: expiryTimestamp is valid ISO string
  it('CD-06: expiryTimestamp is always a valid ISO string', () => {
    const r = computeConfidenceDecay({ initialConfidence: 75, createdAt: RECENT_30M, timeframe: '4H' });
    expect(() => new Date(r.expiryTimestamp)).not.toThrow();
    expect(r.expiryTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // CD-07: unknown timeframe uses default lambda
  it('CD-07: unknown timeframe uses safe default', () => {
    const r = computeConfidenceDecay({ initialConfidence: 75, createdAt: RECENT_30M, timeframe: 'UNKNOWN_TF' });
    expect(r.currentConfidence).toBeGreaterThan(0);
    expect(r.currentConfidence).toBeLessThanOrEqual(75);
  });

  // CD-08: currentConfidence never exceeds initialConfidence
  it('CD-08: currentConfidence never exceeds initialConfidence', () => {
    const r = computeConfidenceDecay({ initialConfidence: 75, createdAt: RECENT_30M, timeframe: '4H' });
    expect(r.currentConfidence).toBeLessThanOrEqual(r.initialConfidence);
  });

});
