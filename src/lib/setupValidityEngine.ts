import type {
  SetupValidity, SetupValidityResult, EntryZoneSource,
  TrendAlignment, SetupActionability, TradeGrade, SetupIntent,
} from '@/types';
import { validateCounterTrend } from './counterTrendValidator';

// ── Constants ─────────────────────────────────────────────────────────────────

export const MAX_AGE_MS: Record<string, number> = {
  '1m':  45 * 60_000,
  '5m':  2  * 60 * 60_000,
  '15m': 90 * 60_000,
  '30m': 3  * 60 * 60_000,
  '1H':  6  * 60 * 60_000,
  '4H':  24 * 60 * 60_000,
  '1D':  3  * 24 * 60 * 60_000,
  '1W':  7  * 24 * 60 * 60_000,
};
export const DEFAULT_MAX_AGE_MS = 24 * 60 * 60_000;

// WATCH_ONLY setups expire faster — these limits apply when actionability is WATCHING
export const WATCH_ONLY_MAX_AGE_MS: Record<string, number> = {
  '1m':  20 * 60_000,
  '5m':  45 * 60_000,
  '15m': 45 * 60_000,
  '30m': 90 * 60_000,
  '1H':  3  * 60 * 60_000,
  '4H':  8  * 60 * 60_000,
  '1D':  24 * 60 * 60_000,
  '1W':  3  * 24 * 60 * 60_000,
};
const DEFAULT_WATCH_ONLY_MAX_AGE_MS = 8 * 60 * 60_000;

// Candle duration per timeframe — used for counter-trend 2-candle expiry rule
export const CANDLE_DURATION_MS: Record<string, number> = {
  '1m':  60_000,
  '5m':  5  * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1H':  60 * 60_000,
  '4H':  4  * 60 * 60_000,
  '1D':  24 * 60 * 60_000,
  '1W':  7  * 24 * 60 * 60_000,
};
const DEFAULT_CANDLE_DURATION_MS = 4 * 60 * 60_000;

// Counter-trend setup expires after this many candles if confirmations < 4
const COUNTER_TREND_EXPIRY_CANDLES = 2;

// Six reversal confirmations required for a counter-trend setup to be actionable
export const REVERSAL_CONFIRMATIONS = [
  'Sell-side liquidity swept',
  'Bullish CHoCH / structure shift on 4H',
  'Reclaim above key level',
  'Bullish acceptance close',
  'Momentum shift to bullish (15m/1H)',
  'Volume confirms reversal',
] as const;

export const SHORT_REVERSAL_CONFIRMATIONS = [
  'Buy-side liquidity swept',
  'Bearish CHoCH / structure shift on 4H',
  'Break below key level',
  'Bearish acceptance close',
  'Momentum shift to bearish (15m/1H)',
  'Volume confirms reversal',
] as const;

// Minimum confirmations to upgrade from WATCH_ONLY to CONFIRMATION_REQUIRED actionability
const MIN_CONFIRMATIONS_FOR_ACTIONABLE = 4;

// ── Input type ────────────────────────────────────────────────────────────────

export interface SetupValidityInput {
  htfBias:       string;
  ltfBias:       string;
  regime:        string;
  currentPrice:  number;
  direction:     'LONG' | 'SHORT';
  entryZoneLow:  number;
  entryZoneHigh: number;
  entryZoneSource?: EntryZoneSource;
  // Evidence flags — all optional; treated as false if absent
  liquidityEvidence?:   boolean;
  structureEvidence?:   boolean;
  acceptanceEvidence?:  boolean;
  momentumEvidence?:    boolean;
  volumeEvidence?:      boolean;
  // Time
  createdAt:   string | Date;
  timeframe:   string;
  // Optional grade from signal — will be capped if needed
  signalGrade?: string;
  // ITOS enrichment — optional; when provided, enables full counter-trend validation
  intent?:            SetupIntent;
  zoneQualityScore?:  number;   // 0–100; defaults to 100 when absent (institutional gate bypassed)
  decayedConfidence?: number;   // 0–100; defaults to 100 when absent
  remainingLifePct?:  number;   // 0–100; defaults to 100 when absent
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isBull(bias: string): boolean {
  const b = bias.toUpperCase();
  return b === 'BULL' || b === 'BULLISH';
}

function isBear(bias: string): boolean {
  const b = bias.toUpperCase();
  return b === 'BEAR' || b === 'BEARISH';
}

export function applyGradeCap(signalGrade: string | undefined, cap: TradeGrade): TradeGrade {
  const order: TradeGrade[] = ['A+', 'A', 'B', 'C', '—'];
  const rawG   = (signalGrade ?? 'B') as TradeGrade;
  const rawIdx = order.indexOf(rawG);
  const capIdx = order.indexOf(cap);
  if (rawIdx === -1 || capIdx === -1) return cap;
  // If raw is better (lower index) than cap, clamp to cap
  return rawIdx < capIdx ? cap : rawG;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function assessSetupValidity(input: SetupValidityInput): SetupValidityResult {
  const {
    htfBias, ltfBias, direction,
    entryZoneLow, entryZoneHigh, currentPrice,
    entryZoneSource = 'UNKNOWN',
    liquidityEvidence = false,
    structureEvidence = false,
    acceptanceEvidence = false,
    momentumEvidence = false,
    volumeEvidence = false,
    createdAt, timeframe, signalGrade,
  } = input;

  const createdMs       = new Date(createdAt).getTime();
  const nowMs           = Date.now();
  const ageMs           = nowMs - createdMs;
  const ageMinutes      = Math.round(ageMs / 60_000);
  const maxAgeMs        = MAX_AGE_MS[timeframe]           ?? DEFAULT_MAX_AGE_MS;
  const woMaxAgeMs      = WATCH_ONLY_MAX_AGE_MS[timeframe] ?? DEFAULT_WATCH_ONLY_MAX_AGE_MS;
  const candleDurationMs = CANDLE_DURATION_MS[timeframe]  ?? DEFAULT_CANDLE_DURATION_MS;
  const ctMaxAgeMs      = COUNTER_TREND_EXPIRY_CANDLES * candleDurationMs;

  const hardExpiryTime = new Date(createdMs + maxAgeMs).toISOString();
  const woExpiryTime   = new Date(createdMs + woMaxAgeMs).toISOString();

  // ── Step 1: Hard expiry — exceeds full max age ──────────────────────────────
  if (ageMs > maxAgeMs) {
    const expiryReason = `Setup exceeded ${timeframe} max age (${Math.round(maxAgeMs / 60_000)}m)`;
    return {
      validity:               'EXPIRED',
      trendAlignment:         'ALIGNED',
      actionability:          'INVALID',
      confidenceCap:          0,
      gradeCap:               '—',
      requiredConfirmations:  [],
      satisfiedConfirmations: [],
      missingConfirmations:   [],
      expiryTime:             hardExpiryTime,
      hardExpiryTime,
      ageMinutes,
      reason:                 `Setup expired — age ${ageMinutes}m exceeds ${timeframe} max (${Math.round(maxAgeMs / 60_000)}m)`,
      expiryReason,
      entryZoneSource,
      entryZoneReason:        'Setup expired — entry zone no longer valid',
      blocked:                true,
    };
  }

  // ── Step 2: Entry zone source — demo/unknown during conflict = INVALID ──────
  const isDemoData = entryZoneSource === 'DEMO_DATA';

  // ── Step 3: Trend alignment ─────────────────────────────────────────────────
  const htfBull = isBull(htfBias);
  const htfBear = isBear(htfBias);
  const ltfBull = isBull(ltfBias);
  const ltfBear = isBear(ltfBias);

  let trendAlignment: TrendAlignment;
  if (direction === 'LONG') {
    if (htfBull && ltfBull)      trendAlignment = 'ALIGNED';
    else if (htfBear && ltfBear) trendAlignment = 'CONFLICT';
    else                         trendAlignment = 'COUNTER_TREND';
  } else {
    if (htfBear && ltfBear)      trendAlignment = 'ALIGNED';
    else if (htfBull && ltfBull) trendAlignment = 'CONFLICT';
    else                         trendAlignment = 'COUNTER_TREND';
  }

  // ── Step 4: Reversal evidence ───────────────────────────────────────────────
  const isLong = direction === 'LONG';
  const requiredConfs = isLong
    ? [...REVERSAL_CONFIRMATIONS]
    : [...SHORT_REVERSAL_CONFIRMATIONS];

  const evidenceFlags = [liquidityEvidence, structureEvidence, acceptanceEvidence, momentumEvidence, volumeEvidence];
  // Map confirmation index to evidence flag (volume is index 5, not in evidenceFlags — treat as false)
  const confirmed: boolean[] = [
    liquidityEvidence,   // 0: liquidity swept
    structureEvidence,   // 1: CHoCH / structure shift
    acceptanceEvidence,  // 2: reclaim above/below key level
    acceptanceEvidence,  // 3: acceptance close (same gate as reclaim)
    momentumEvidence,    // 4: momentum shift
    volumeEvidence,      // 5: volume confirms
  ];

  let satisfied: string[] = requiredConfs.filter((_, i) => confirmed[i]);
  let missing:   string[] = requiredConfs.filter((_, i) => !confirmed[i]);

  // ── Step 5: Validity + actionability based on alignment ────────────────────
  let validity:     SetupValidity;
  let actionability: SetupActionability;
  let confidenceCap: number;
  let gradeCap:      TradeGrade;
  let reason:        string;
  let blocked        = false;

  if (trendAlignment === 'ALIGNED') {
    validity      = 'VALID';
    actionability = 'READY';
    confidenceCap = 100;
    gradeCap      = 'A+';
    reason        = `${direction} aligns with HTF (${htfBias}) and LTF (${ltfBias}) trend`;
  } else if (trendAlignment === 'COUNTER_TREND') {
    // One side aligns, one opposes
    if (input.intent === 'COUNTER_TREND' || input.intent === 'REVERSAL') {
      // Full institutional validation path
      const ctResult = validateCounterTrend({
        intent:            input.intent,
        direction,
        trendAlignment,
        entryZoneSource,
        zoneQualityScore:  input.zoneQualityScore  ?? 100,
        decayedConfidence: input.decayedConfidence ?? 100,
        remainingLifePct:  input.remainingLifePct  ?? 100,
        liquidityEvidence, structureEvidence, acceptanceEvidence, momentumEvidence, volumeEvidence,
      });
      satisfied     = ctResult.satisfiedConfirmations;
      missing       = ctResult.missingConfirmations;
      validity      = 'WATCH_ONLY';
      confidenceCap = 60;
      gradeCap      = 'B';
      if (ctResult.approved) {
        actionability = 'CONFIRMATION_REQUIRED';
        reason        = ctResult.reason;
      } else {
        actionability = 'WATCHING';
        confidenceCap = 40;
        gradeCap      = 'C';
        blocked       = true;
        reason        = ctResult.reason;
      }
    } else if (satisfied.length >= MIN_CONFIRMATIONS_FOR_ACTIONABLE) {
      validity      = 'WATCH_ONLY';
      actionability = 'CONFIRMATION_REQUIRED';
      confidenceCap = 60;
      gradeCap      = 'B';
      reason        = `Counter-trend ${direction}: ${satisfied.length}/${requiredConfs.length} confirmations met — partial reversal evidence`;
    } else {
      validity      = 'WATCH_ONLY';
      actionability = 'WATCHING';
      confidenceCap = 40;
      gradeCap      = 'C';
      blocked       = true;
      reason        = `Counter-trend ${direction}: only ${satisfied.length}/${requiredConfs.length} reversal confirmations — watch only`;
    }
  } else {
    // CONFLICT — both HTF and LTF oppose the setup direction
    if (isDemoData) {
      validity      = 'INVALID';
      actionability = 'INVALID';
      confidenceCap = 0;
      gradeCap      = '—';
      blocked       = true;
      reason        = `Counter-trend ${direction} from demo/static data — invalid for live use`;
    } else if (input.intent === 'REVERSAL') {
      // Full reversal validation path for CONFLICT setups
      const ctResult = validateCounterTrend({
        intent:            'REVERSAL',
        direction,
        trendAlignment,
        entryZoneSource,
        zoneQualityScore:  input.zoneQualityScore  ?? 100,
        decayedConfidence: input.decayedConfidence ?? 100,
        remainingLifePct:  input.remainingLifePct  ?? 100,
        liquidityEvidence, structureEvidence, acceptanceEvidence, momentumEvidence, volumeEvidence,
      });
      satisfied     = ctResult.satisfiedConfirmations;
      missing       = ctResult.missingConfirmations;
      validity      = 'WATCH_ONLY';
      confidenceCap = 50;
      gradeCap      = 'C';
      if (ctResult.approved) {
        actionability = 'CONFIRMATION_REQUIRED';
        reason        = ctResult.reason;
      } else {
        actionability = 'WATCHING';
        confidenceCap = 40;
        blocked       = true;
        reason        = ctResult.reason;
      }
    } else if (satisfied.length >= requiredConfs.length) {
      // All 6 reversal confirmations met — upgrade to CONFIRMATION_REQUIRED
      validity      = 'WATCH_ONLY';
      actionability = 'CONFIRMATION_REQUIRED';
      confidenceCap = 50;
      gradeCap      = 'C';
      reason        = `Counter-trend CONFLICT: ${direction} with all ${requiredConfs.length} confirmations — requires manual confirmation`;
    } else {
      // Incomplete reversal evidence — WATCH_ONLY, blocked
      validity      = 'WATCH_ONLY';
      actionability = 'WATCHING';
      confidenceCap = 40;
      gradeCap      = 'C';
      blocked       = true;
      reason        = `Counter-trend CONFLICT: ${direction} vs HTF ${htfBias} + LTF ${ltfBias} — ${missing.length} reversal confirmations missing`;
    }
  }

  // ── Step 5b: WATCH_ONLY accelerated expiry ─────────────────────────────────
  // WATCHING setups expire faster than VALID/CONFIRMATION_REQUIRED setups.
  if (actionability === 'WATCHING' && ageMs > woMaxAgeMs) {
    const expiryReason = `Watch-only ${timeframe} setup exceeded ${Math.round(woMaxAgeMs / 60_000)}m limit — rescan required`;
    return {
      validity:               'EXPIRED',
      trendAlignment,
      actionability:          'INVALID',
      confidenceCap:          0,
      gradeCap:               '—',
      requiredConfirmations:  trendAlignment === 'ALIGNED' ? [] : requiredConfs,
      satisfiedConfirmations: trendAlignment === 'ALIGNED' ? [] : satisfied,
      missingConfirmations:   trendAlignment === 'ALIGNED' ? [] : missing,
      expiryTime:             woExpiryTime,
      hardExpiryTime,
      ageMinutes,
      reason:                 `Watch-only setup expired — age ${ageMinutes}m exceeds ${timeframe} WATCH_ONLY limit (${Math.round(woMaxAgeMs / 60_000)}m)`,
      expiryReason,
      entryZoneSource,
      entryZoneReason:        'Watch-only setup expired — conditions not confirmed within time limit',
      blocked:                true,
    };
  }

  // ── Step 5c: Counter-trend fast expiry — 2 candles without sufficient confirmations ──
  // Counter-trend/conflict setups with < 4 confirmations expire after 2 candles.
  const isCounterTrendSetup = trendAlignment === 'COUNTER_TREND' || trendAlignment === 'CONFLICT';
  if (
    isCounterTrendSetup &&
    actionability === 'WATCHING' &&
    satisfied.length < 4 &&
    ageMs > ctMaxAgeMs
  ) {
    const ctCandles = COUNTER_TREND_EXPIRY_CANDLES;
    const ctMaxMin  = Math.round(ctMaxAgeMs / 60_000);
    const expiryReason = `Counter-trend ${direction} — ${satisfied.length}/4 confirmations after ${ctCandles} candles (${ctMaxMin}m)`;
    return {
      validity:               'EXPIRED',
      trendAlignment,
      actionability:          'INVALID',
      confidenceCap:          0,
      gradeCap:               '—',
      requiredConfirmations:  requiredConfs,
      satisfiedConfirmations: satisfied,
      missingConfirmations:   missing,
      expiryTime:             new Date(createdMs + ctMaxAgeMs).toISOString(),
      hardExpiryTime,
      ageMinutes,
      reason:                 `Counter-trend setup expired — only ${satisfied.length} confirmations after ${ctCandles} ${timeframe} candles`,
      expiryReason,
      entryZoneSource,
      entryZoneReason:        'Counter-trend setup expired without reversal confirmation',
      blocked:                true,
    };
  }

  // ── Step 6: Entry zone source validation ───────────────────────────────────
  let entryZoneReason: string;
  const zoneAbovePrice = entryZoneLow > currentPrice;
  const zoneBelowPrice = entryZoneHigh < currentPrice;

  if (isDemoData) {
    entryZoneReason = 'Demo/static data — entry zone not derived from current market structure';
    validity      = 'INVALID';
    actionability = 'INVALID';
    blocked       = true;
    reason        = 'Entry zone from demo/static data — invalid';
  } else if (entryZoneSource === 'UNKNOWN') {
    entryZoneReason = 'Entry zone source unknown — from webhook signal without structure reference';
    if (trendAlignment === 'CONFLICT') {
      // Unknown source + conflict = WATCH_ONLY at most
      if (validity === 'VALID') {
        validity      = 'WATCH_ONLY';
        actionability = 'WATCHING';
        blocked       = true;
      }
    }
  } else if (trendAlignment === 'CONFLICT' && direction === 'LONG' && zoneAbovePrice) {
    entryZoneReason = `Long entry zone $${entryZoneLow}–$${entryZoneHigh} is above current price $${currentPrice} during bearish trend — price must first reclaim structure`;
  } else if (trendAlignment === 'CONFLICT' && direction === 'SHORT' && zoneBelowPrice) {
    entryZoneReason = `Short entry zone $${entryZoneLow}–$${entryZoneHigh} is below current price $${currentPrice} during bullish trend — price must first break structure`;
  } else {
    entryZoneReason = `Entry zone $${entryZoneLow}–$${entryZoneHigh} — source: ${entryZoneSource.toLowerCase().replace(/_/g, ' ')}`;
  }

  // Effective expiry: WATCHING uses shorter WATCH_ONLY limit; VALID/CONFIRMATION_REQUIRED uses full max
  const effectiveExpiryTime = actionability === 'WATCHING' ? woExpiryTime : hardExpiryTime;

  return {
    validity,
    trendAlignment,
    actionability,
    confidenceCap,
    gradeCap,             // ceiling — consumer applies with applyGradeCap()
    requiredConfirmations:  trendAlignment === 'ALIGNED' ? [] : requiredConfs,
    satisfiedConfirmations: trendAlignment === 'ALIGNED' ? [] : satisfied,
    missingConfirmations:   trendAlignment === 'ALIGNED' ? [] : missing,
    expiryTime:             effectiveExpiryTime,
    hardExpiryTime,
    ageMinutes,
    reason,
    entryZoneSource,
    entryZoneReason,
    blocked,
  };
}
