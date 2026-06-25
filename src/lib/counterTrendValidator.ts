import type { SetupIntent, TrendAlignment, EntryZoneSource } from '@/types';
import {
  REVERSAL_CONFIRMATIONS,
  SHORT_REVERSAL_CONFIRMATIONS,
} from './setupValidityEngine';

// ── Input ─────────────────────────────────────────────────────────────────────

export interface CounterTrendValidatorInput {
  intent:             SetupIntent;
  direction:          'LONG' | 'SHORT';
  trendAlignment:     TrendAlignment;
  entryZoneSource:    EntryZoneSource;
  zoneQualityScore:   number;        // 0–100 from entryZoneQuality
  decayedConfidence:  number;        // after decay
  remainingLifePct:   number;        // 0–100
  // Evidence flags
  liquidityEvidence:  boolean;
  structureEvidence:  boolean;
  acceptanceEvidence: boolean;
  momentumEvidence:   boolean;
  volumeEvidence:     boolean;
}

export interface CounterTrendValidationResult {
  approved:                boolean;
  satisfiedConfirmations:  string[];
  missingConfirmations:    string[];
  requiredConfirmations:   string[];
  confirmationCount:       number;
  minimumRequired:         number;
  reason:                  string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_CONFIRMATIONS_REVERSAL     = 6;  // all 6 evidence gates
const MIN_CONFIRMATIONS_COUNTER_TREND = 4; // 4 of 6 evidence gates
const MIN_ZONE_QUALITY_REVERSAL      = 50;
const MIN_ZONE_QUALITY_COUNTER_TREND = 30;
const MIN_DECAYED_CONFIDENCE         = 35;
const MIN_REMAINING_LIFE_PCT         = 20;

// Additional institutional checks (checks 7–10)
const INSTITUTIONAL_CHECKS = [
  'Entry zone quality score ≥ threshold',
  'Decayed confidence ≥ 35%',
  'Remaining setup life ≥ 20%',
  'Entry zone source identified (not UNKNOWN)',
] as const;

// ── Main ──────────────────────────────────────────────────────────────────────

export function validateCounterTrend(input: CounterTrendValidatorInput): CounterTrendValidationResult {
  const {
    intent, direction,
    entryZoneSource, zoneQualityScore, decayedConfidence, remainingLifePct,
    liquidityEvidence, structureEvidence, acceptanceEvidence, momentumEvidence, volumeEvidence,
  } = input;

  const isReversal = intent === 'REVERSAL';
  const baseConfs  = direction === 'LONG'
    ? [...REVERSAL_CONFIRMATIONS]
    : [...SHORT_REVERSAL_CONFIRMATIONS];
  const minRequired = isReversal ? MIN_CONFIRMATIONS_REVERSAL : MIN_CONFIRMATIONS_COUNTER_TREND;
  const minZoneQ    = isReversal ? MIN_ZONE_QUALITY_REVERSAL : MIN_ZONE_QUALITY_COUNTER_TREND;

  // ── Evidence flags → confirmation mapping (checks 1–6) ────────────────────
  const evidenceMap: boolean[] = [
    liquidityEvidence,   // 1: liquidity swept
    structureEvidence,   // 2: CHoCH / structure shift
    acceptanceEvidence,  // 3: reclaim above/below key level
    acceptanceEvidence,  // 4: acceptance close (same gate)
    momentumEvidence,    // 5: momentum shift
    volumeEvidence,      // 6: volume confirms
  ];

  const satisfied6 = baseConfs.filter((_, i) => evidenceMap[i]);
  const missing6   = baseConfs.filter((_, i) => !evidenceMap[i]);

  // ── Institutional checks (checks 7–10) ─────────────────────────────────────
  const instChecks: boolean[] = [
    zoneQualityScore   >= minZoneQ,
    decayedConfidence  >= MIN_DECAYED_CONFIDENCE,
    remainingLifePct   >= MIN_REMAINING_LIFE_PCT,
    entryZoneSource !== 'UNKNOWN' && entryZoneSource !== 'DEMO_DATA',
  ];

  const satisfiedInst = INSTITUTIONAL_CHECKS.filter((_, i) => instChecks[i]);
  const missingInst   = INSTITUTIONAL_CHECKS.filter((_, i) => !instChecks[i]);

  const allRequired    = [...baseConfs, ...INSTITUTIONAL_CHECKS];
  const allSatisfied   = [...satisfied6, ...satisfiedInst];
  const allMissing     = [...missing6,   ...missingInst];

  const confirmed6Count = satisfied6.length;

  // ── Approval decision ──────────────────────────────────────────────────────
  // Primary gate: must meet minimum evidence confirmations
  if (confirmed6Count < minRequired) {
    return {
      approved:               false,
      satisfiedConfirmations: allSatisfied,
      missingConfirmations:   allMissing,
      requiredConfirmations:  allRequired,
      confirmationCount:      confirmed6Count,
      minimumRequired:        minRequired,
      reason: `${confirmed6Count}/${minRequired} required confirmations met — ${isReversal ? 'reversal' : 'counter-trend'} setup not approved`,
    };
  }

  // Secondary gate: institutional quality checks
  if (instChecks.some((c) => !c)) {
    return {
      approved:               false,
      satisfiedConfirmations: allSatisfied,
      missingConfirmations:   allMissing,
      requiredConfirmations:  allRequired,
      confirmationCount:      confirmed6Count,
      minimumRequired:        minRequired,
      reason: `Evidence confirmations met but institutional quality gates failed: ${missingInst.join(', ')}`,
    };
  }

  return {
    approved:               true,
    satisfiedConfirmations: allSatisfied,
    missingConfirmations:   [],
    requiredConfirmations:  allRequired,
    confirmationCount:      confirmed6Count,
    minimumRequired:        minRequired,
    reason: `${confirmed6Count}/${baseConfs.length} confirmations + all institutional gates passed — ${isReversal ? 'reversal' : 'counter-trend'} approved`,
  };
}
