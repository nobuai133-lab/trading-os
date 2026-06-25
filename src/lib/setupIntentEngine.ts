import type { SetupIntent, TrendAlignment, EntryZoneSource, Direction } from '@/types';

// ── Input ─────────────────────────────────────────────────────────────────────

export interface SetupIntentInput {
  direction:       Direction;
  htfBias:         string;
  ltfBias:         string;
  regime:          string;
  entryZoneSource: EntryZoneSource;
  trendAlignment:  TrendAlignment;
}

export interface SetupIntentResult {
  intent:         SetupIntent;
  riskMultiplier: number;
  reason:         string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const INTENT_RISK_MULTIPLIER: Record<SetupIntent, number> = {
  TREND_CONTINUATION:      1.00,
  BREAKOUT_CONTINUATION:   0.90,
  BREAKDOWN_CONTINUATION:  0.90,
  RETEST_CONTINUATION:     0.85,
  LIQUIDITY_SWEEP:         0.60,
  RANGE_REVERSION:         0.70,
  COUNTER_TREND:           0.30,
  REVERSAL:                0.50,
  INVALID:                 0.00,
};

// Lower = higher priority in rankings
export const INTENT_RANK: Record<SetupIntent, number> = {
  TREND_CONTINUATION:     1,
  BREAKOUT_CONTINUATION:  2,
  BREAKDOWN_CONTINUATION: 2,
  RETEST_CONTINUATION:    3,
  LIQUIDITY_SWEEP:        4,
  RANGE_REVERSION:        5,
  REVERSAL:               6,
  COUNTER_TREND:          7,
  INVALID:                99,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isRanging(regime: string): boolean {
  const r = regime.toUpperCase();
  return r === 'RANGING' || r === 'RANGE' || r === 'ACCUMULATION' || r === 'DISTRIBUTION';
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function classifySetupIntent(input: SetupIntentInput): SetupIntentResult {
  const { entryZoneSource, trendAlignment, regime, direction } = input;

  // 1. Demo / static data is always invalid
  if (entryZoneSource === 'DEMO_DATA') {
    return result('INVALID', 'Entry zone from demo/static data');
  }

  // 2. Liquidity sweep reclaim takes priority — specific institutional setup
  if (entryZoneSource === 'LIQUIDITY_SWEEP_RECLAIM') {
    return result('LIQUIDITY_SWEEP', `Liquidity sweep reclaim — ${direction}`);
  }

  // 3. Ranging regime → fade the range extremes
  if (isRanging(regime)) {
    return result('RANGE_REVERSION', `Range reversion ${direction} in ${regime} regime`);
  }

  // 4. Aligned setups — classify by entry zone source
  if (trendAlignment === 'ALIGNED') {
    if (entryZoneSource === 'RETEST_BREAKOUT') {
      return result('BREAKOUT_CONTINUATION', `Breakout continuation ${direction} — retesting broken resistance`);
    }
    if (entryZoneSource === 'RETEST_BREAKDOWN') {
      return result('BREAKDOWN_CONTINUATION', `Breakdown continuation ${direction} — retesting broken support`);
    }
    if (entryZoneSource === 'SUPPLY_ZONE' || entryZoneSource === 'DEMAND_ZONE' || entryZoneSource === 'VALUE_AREA') {
      return result('RETEST_CONTINUATION', `Retest continuation ${direction} from ${entryZoneSource.toLowerCase().replace('_', ' ')}`);
    }
    return result('TREND_CONTINUATION', `Trend continuation ${direction} — aligned HTF + LTF`);
  }

  // 5. Counter-trend (one side opposes)
  if (trendAlignment === 'COUNTER_TREND') {
    return result('COUNTER_TREND', `Counter-trend ${direction} — partial bias misalignment`);
  }

  // 6. Conflict (both sides oppose) — requires reversal evidence to be REVERSAL, otherwise COUNTER_TREND
  if (trendAlignment === 'CONFLICT') {
    return result('REVERSAL', `Potential reversal ${direction} — both HTF and LTF oppose direction`);
  }

  return result('INVALID', `Cannot classify intent for ${direction}`);
}

function result(intent: SetupIntent, reason: string): SetupIntentResult {
  return { intent, riskMultiplier: INTENT_RISK_MULTIPLIER[intent], reason };
}
