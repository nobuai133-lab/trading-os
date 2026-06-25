import { describe, it, expect } from 'vitest';
import { calibrateConfidence, calibrationLabel } from '../confidenceCalibrator';

describe('calibrateConfidence', () => {
  it('TC-CAL01 — exact example: base=88, winSim=92, lossSim=14, n=10 → 91', () => {
    expect(calibrateConfidence(88, 92, 14, 10)).toBe(91);
  });

  it('TC-CAL02 — equal similarities → no adjustment (edge=0)', () => {
    expect(calibrateConfidence(70, 60, 60, 10)).toBe(70);
  });

  it('TC-CAL03 — high losing similarity deflates confidence', () => {
    const result = calibrateConfidence(80, 20, 90, 10);
    expect(result).toBeLessThan(80);
  });

  it('TC-CAL04 — high winning similarity boosts confidence', () => {
    const result = calibrateConfidence(80, 95, 10, 10);
    expect(result).toBeGreaterThan(80);
  });

  it('TC-CAL05 — fewer than 5 samples → returns base unchanged', () => {
    expect(calibrateConfidence(75, 90, 10, 4)).toBe(75);
    expect(calibrateConfidence(75, 90, 10, 0)).toBe(75);
  });

  it('TC-CAL06 — result is clamped to [0, 100]', () => {
    expect(calibrateConfidence(99, 100, 0, 10)).toBeLessThanOrEqual(100);
    expect(calibrateConfidence(1, 0, 100, 10)).toBeGreaterThanOrEqual(0);
  });

  it('TC-CAL07 — result is an integer (rounded)', () => {
    const result = calibrateConfidence(73, 88, 22, 8);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('TC-CAL08 — exactly 5 samples (boundary) applies calibration', () => {
    const withFive = calibrateConfidence(80, 90, 10, 5);
    const withFour = calibrateConfidence(80, 90, 10, 4);
    expect(withFive).not.toBe(80);   // calibration applied
    expect(withFour).toBe(80);        // not applied
  });
});

describe('calibrationLabel', () => {
  it('TC-CAL09 — positive delta shows boost', () => {
    expect(calibrationLabel(80, 83)).toContain('+3%');
    expect(calibrationLabel(80, 83)).toContain('boost');
  });

  it('TC-CAL10 — negative delta shows drag', () => {
    expect(calibrationLabel(80, 77)).toContain('-3%');
    expect(calibrationLabel(80, 77)).toContain('drag');
  });

  it('TC-CAL11 — zero delta shows unchanged', () => {
    expect(calibrationLabel(80, 80)).toBe('Unchanged');
  });
});
