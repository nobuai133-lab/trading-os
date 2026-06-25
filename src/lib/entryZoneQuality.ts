import type {
  EntryZoneQualityResult, EntryZoneQualityFactor,
  EntryZoneSource, TrendAlignment,
} from '@/types';

// ── Source reliability scores (out of 30) ────────────────────────────────────

const SOURCE_SCORE: Record<EntryZoneSource, number> = {
  RETEST_BREAKOUT:        28,
  RETEST_BREAKDOWN:       28,
  LIQUIDITY_SWEEP_RECLAIM: 25,
  DEMAND_ZONE:            20,
  SUPPLY_ZONE:            20,
  VALUE_AREA:             15,
  UNKNOWN:                 5,
  DEMO_DATA:               0,
};

// ── Input ─────────────────────────────────────────────────────────────────────

export interface EntryZoneQualityInput {
  entryZoneSource:    EntryZoneSource;
  trendAlignment:     TrendAlignment;
  liquidityEvidence:  boolean;
  structureEvidence:  boolean;
  acceptanceEvidence: boolean;
  momentumEvidence:   boolean;
  volumeEvidence:     boolean;
  ageMinutes:         number;
  timeframe:          string;
}

// Max age in minutes per timeframe (mirrors other engines)
const FRESHNESS_MAX_MINUTES: Record<string, number> = {
  '1m':  45,
  '5m':  120,
  '15m': 90,
  '30m': 180,
  '1H':  360,
  '4H':  1440,
  '1D':  4320,
  '1W':  10080,
};
const DEFAULT_FRESHNESS_MAX = 1440;

// ── Main ──────────────────────────────────────────────────────────────────────

export function scoreEntryZoneQuality(input: EntryZoneQualityInput): EntryZoneQualityResult {
  const {
    entryZoneSource, trendAlignment,
    liquidityEvidence, structureEvidence, acceptanceEvidence, momentumEvidence, volumeEvidence,
    ageMinutes, timeframe,
  } = input;

  const factors: EntryZoneQualityFactor[] = [];
  let total = 0;

  // ── Factor 1: Source reliability (0–30) ─────────────────────────────────────
  const srcScore = SOURCE_SCORE[entryZoneSource] ?? 5;
  factors.push({
    name:        'Source Reliability',
    score:       srcScore,
    maxScore:    30,
    description: `Entry zone source: ${entryZoneSource.toLowerCase().replace(/_/g, ' ')}`,
  });
  total += srcScore;

  // ── Factor 2: Trend alignment (0–25) ─────────────────────────────────────────
  const alignScore = trendAlignment === 'ALIGNED' ? 25
    : trendAlignment === 'COUNTER_TREND' ? 10 : 0;
  factors.push({
    name:        'Trend Alignment',
    score:       alignScore,
    maxScore:    25,
    description: `Trend alignment: ${trendAlignment.toLowerCase().replace(/_/g, ' ')}`,
  });
  total += alignScore;

  // ── Factor 3: Evidence (0–30, 6pts each) ─────────────────────────────────────
  const evidenceFlags = [liquidityEvidence, structureEvidence, acceptanceEvidence, momentumEvidence, volumeEvidence];
  const evidenceNames = ['Liquidity', 'Structure', 'Acceptance', 'Momentum', 'Volume'];
  const evidenceScore = evidenceFlags.filter(Boolean).length * 6;
  const presentNames  = evidenceNames.filter((_, i) => evidenceFlags[i]);
  factors.push({
    name:        'Evidence Flags',
    score:       evidenceScore,
    maxScore:    30,
    description: presentNames.length > 0
      ? `Present: ${presentNames.join(', ')}`
      : 'No evidence flags set',
  });
  total += evidenceScore;

  // ── Factor 4: Freshness (0–15) ────────────────────────────────────────────────
  const maxAge    = FRESHNESS_MAX_MINUTES[timeframe] ?? DEFAULT_FRESHNESS_MAX;
  const agePct    = Math.min(1, ageMinutes / maxAge);
  const freshScore = Math.round((1 - agePct) * 15);
  factors.push({
    name:        'Freshness',
    score:       freshScore,
    maxScore:    15,
    description: `Setup age: ${ageMinutes}m (max: ${maxAge}m)`,
  });
  total += freshScore;

  // ── Penalty: DEMO_DATA or UNKNOWN source ──────────────────────────────────────
  if (entryZoneSource === 'DEMO_DATA') {
    return {
      score:   0,
      label:   'INVALID',
      factors,
      reason:  'Demo/static data — entry zone quality invalid',
    };
  }

  const score = Math.min(100, Math.max(0, total));
  const label = score >= 80 ? 'EXCELLENT'
    : score >= 60 ? 'GOOD'
    : score >= 40 ? 'FAIR'
    : score > 0   ? 'POOR'
    : 'INVALID';

  const reason = `Zone quality ${score}/100 (${label.toLowerCase()}) — ${
    score >= 60 ? 'entry zone well-supported' : 'entry zone needs more confirmation'
  }`;

  return { score, label, factors, reason };
}
