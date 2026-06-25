import type { ConfidenceDecay } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

// Max age in minutes per timeframe (mirrors MAX_AGE_MS in setupValidityEngine)
const MAX_AGE_MINUTES: Record<string, number> = {
  '1m':  45,
  '5m':  120,
  '15m': 90,
  '30m': 180,
  '1H':  360,
  '4H':  1440,
  '1D':  4320,
  '1W':  10080,
};
const DEFAULT_MAX_AGE_MINUTES = 1440;

// Decay lambda: chosen so confidence reaches ~10% of initial at expiry
// λ = -ln(0.10) / maxAgeMinutes ≈ 2.3026 / maxAgeMinutes
const DECAY_LAMBDA: Record<string, number> = {
  '1m':  0.0512,
  '5m':  0.0192,
  '15m': 0.0256,
  '30m': 0.0128,
  '1H':  0.0064,
  '4H':  0.0016,
  '1D':  0.0005,
  '1W':  0.00023,
};
const DEFAULT_DECAY_LAMBDA = 0.0016;

// ── Input ─────────────────────────────────────────────────────────────────────

export interface SetupDecayInput {
  initialConfidence: number;
  createdAt:         string | Date;
  timeframe:         string;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function computeConfidenceDecay(input: SetupDecayInput): ConfidenceDecay {
  const { initialConfidence, createdAt, timeframe } = input;

  const createdMs       = new Date(createdAt).getTime();
  const nowMs           = Date.now();
  const ageMinutes      = Math.max(0, (nowMs - createdMs) / 60_000);
  const lambda          = DECAY_LAMBDA[timeframe]       ?? DEFAULT_DECAY_LAMBDA;
  const maxAgeMinutes   = MAX_AGE_MINUTES[timeframe]    ?? DEFAULT_MAX_AGE_MINUTES;
  const expiryTimestamp = new Date(createdMs + maxAgeMinutes * 60_000).toISOString();

  // Exponential decay
  const rawDecayed      = initialConfidence * Math.exp(-lambda * ageMinutes);
  const currentConfidence = Math.max(0, Math.round(rawDecayed));

  // Remaining life as fraction of total allowed age
  const remainingLifePct = Math.max(0, Math.round((1 - ageMinutes / maxAgeMinutes) * 100));

  return {
    initialConfidence,
    currentConfidence,
    decayLambda: lambda,
    ageMinutes:  Math.round(ageMinutes),
    remainingLifePct,
    expiryTimestamp,
  };
}
