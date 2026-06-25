import type {
  SetupIntent, SetupPriorityTier, InstitutionalClass, SetupRank,
  TrendAlignment, SetupValidity,
} from '@/types';
import { INTENT_RISK_MULTIPLIER, INTENT_RANK } from './setupIntentEngine';

// ── Input ─────────────────────────────────────────────────────────────────────

export interface SetupPriorityInput {
  intent:              SetupIntent;
  trendAlignment:      TrendAlignment;
  validity:            SetupValidity;
  blocked:             boolean;
  confidenceCap:       number;
  decayedConfidence:   number;
  zoneQualityScore:    number;
  remainingLifePct:    number;
  satisfiedCount:      number;
  requiredCount:       number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Weights for priority score (must sum to 100)
const WEIGHT_INTENT          = 30;
const WEIGHT_ALIGNMENT       = 25;
const WEIGHT_VALIDITY        = 20;
const WEIGHT_ZONE_QUALITY    = 15;
const WEIGHT_REMAINING_LIFE  = 10;

// Intent score 0–100 (mapped from rank; lower rank = higher score)
const INTENT_SCORE: Record<SetupIntent, number> = {
  TREND_CONTINUATION:      100,
  BREAKOUT_CONTINUATION:    90,
  BREAKDOWN_CONTINUATION:   90,
  RETEST_CONTINUATION:      80,
  LIQUIDITY_SWEEP:          60,
  RANGE_REVERSION:          70,
  REVERSAL:                 40,
  COUNTER_TREND:            30,
  INVALID:                   0,
};

const ALIGNMENT_SCORE: Record<TrendAlignment, number> = {
  ALIGNED:       100,
  COUNTER_TREND:  40,
  CONFLICT:       10,
};

const VALIDITY_SCORE: Record<SetupValidity, number> = {
  VALID:      100,
  WATCH_ONLY:  40,
  INVALID:      0,
  EXPIRED:      0,
};

// ── Institutional classification ──────────────────────────────────────────────

function deriveInstitutionalClass(
  priorityScore:   number,
  intent:          SetupIntent,
  trendAlignment:  TrendAlignment,
  decayedConf:     number,
): InstitutionalClass {
  if (intent === 'INVALID') return 'D';

  if (priorityScore >= 85 && trendAlignment === 'ALIGNED' && decayedConf >= 70) return 'A+';
  if (priorityScore >= 75 && trendAlignment === 'ALIGNED' && decayedConf >= 55) return 'A';
  if (priorityScore >= 60 && decayedConf >= 45) return 'B';
  if (priorityScore >= 45 && decayedConf >= 35) return 'B-';
  if (priorityScore >= 30) return 'C';
  return 'D';
}

// ── Tier assignment ───────────────────────────────────────────────────────────

function deriveTier(
  intent:         SetupIntent,
  validity:       SetupValidity,
  blocked:        boolean,
  trendAlignment: TrendAlignment,
  iClass:         InstitutionalClass,
): SetupPriorityTier {
  if (intent === 'INVALID' || validity === 'INVALID' || validity === 'EXPIRED') {
    return 'INVALID';
  }

  // Blocked counter-trend/reversal setups never reach PRIMARY
  if (blocked && (trendAlignment === 'CONFLICT' || trendAlignment === 'COUNTER_TREND')) {
    return 'WATCHLIST';
  }

  if (validity === 'VALID' && !blocked && (iClass === 'A+' || iClass === 'A')) return 'PRIMARY';
  if (validity === 'VALID' && !blocked && (iClass === 'B' || iClass === 'B-')) return 'SECONDARY';
  if (validity === 'WATCH_ONLY' && !blocked) return 'SECONDARY';
  return 'WATCHLIST';
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function rankSetup(input: SetupPriorityInput): SetupRank {
  const {
    intent, trendAlignment, validity, blocked,
    decayedConfidence, zoneQualityScore, remainingLifePct,
  } = input;

  const intentScore    = INTENT_SCORE[intent]            ?? 0;
  const alignScore     = ALIGNMENT_SCORE[trendAlignment] ?? 0;
  const validityScore  = VALIDITY_SCORE[validity]        ?? 0;

  const priorityScore = Math.round(
    intentScore         * (WEIGHT_INTENT         / 100) +
    alignScore          * (WEIGHT_ALIGNMENT       / 100) +
    validityScore       * (WEIGHT_VALIDITY        / 100) +
    zoneQualityScore    * (WEIGHT_ZONE_QUALITY    / 100) +
    remainingLifePct    * (WEIGHT_REMAINING_LIFE  / 100),
  );

  const institutionalClass = deriveInstitutionalClass(
    priorityScore, intent, trendAlignment, decayedConfidence,
  );

  const tier = deriveTier(intent, validity, blocked, trendAlignment, institutionalClass);

  return {
    tier,
    priorityScore:      Math.min(100, Math.max(0, priorityScore)),
    institutionalClass,
    riskMultiplier:     INTENT_RISK_MULTIPLIER[intent] ?? 0,
    intentRank:         INTENT_RANK[intent]            ?? 99,
  };
}
