// Confidence Calibration Engine — adjusts Decision confidence using memory similarity.
//
// Formula (validated against example: base=88, winSim=92, lossSim=14 → calibrated=91):
//   netEdge     = clamp((winningSim - losingSim) / 100, -1, 1)
//   multiplier  = 1 + netEdge × MAX_FACTOR          // max ±5%
//   calibrated  = clamp(round(base × multiplier), 0, 100)
//
// Minimum 5 trades required; below that, base confidence is returned unchanged.

const MAX_CALIBRATION_FACTOR = 0.05;  // ±5% maximum adjustment
const MIN_SAMPLE_SIZE        = 5;

export function calibrateConfidence(
  baseConfidence:    number,
  winningSimilarity: number,
  losingSimilarity:  number,
  sampleSize:        number,
): number {
  if (sampleSize < MIN_SAMPLE_SIZE) return baseConfidence;

  const netEdge   = Math.max(-1, Math.min(1, (winningSimilarity - losingSimilarity) / 100));
  const multiplier = 1 + netEdge * MAX_CALIBRATION_FACTOR;
  return Math.max(0, Math.min(100, Math.round(baseConfidence * multiplier)));
}

// Describe the calibration direction for display
export function calibrationLabel(base: number, calibrated: number): string {
  const delta = calibrated - base;
  if (Math.abs(delta) < 1)  return 'Unchanged';
  return delta > 0 ? `+${delta}% (memory boost)` : `${delta}% (memory drag)`;
}
