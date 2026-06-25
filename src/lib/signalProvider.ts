import { timingSafeEqual } from 'crypto';
import type { SetupIntent, EntryZoneSource } from '@/types';

// Valid values for server-side coercion of Pine-provided fields
const VALID_SETUP_INTENTS = new Set<SetupIntent>([
  'TREND_CONTINUATION', 'BREAKOUT_CONTINUATION', 'BREAKDOWN_CONTINUATION',
  'RETEST_CONTINUATION', 'REVERSAL', 'COUNTER_TREND', 'RANGE_REVERSION',
  'LIQUIDITY_SWEEP', 'INVALID',
]);
const VALID_ENTRY_ZONE_SOURCES = new Set<EntryZoneSource>([
  'RETEST_BREAKDOWN', 'RETEST_BREAKOUT', 'LIQUIDITY_SWEEP_RECLAIM',
  'SUPPLY_ZONE', 'DEMAND_ZONE', 'VALUE_AREA', 'DEMO_DATA', 'UNKNOWN',
]);

export interface WebhookSignal {
  symbol: string;
  timeframe: string;
  signal: string;
  setupId?: string;
  direction?: string;
  entryPrice?: number;
  sl?: number;
  tp1?: number;
  tp2?: number;
  tp3?: number;
  rangeHigh?: number;
  rangeLow?: number;
  entryZoneHigh?: number;
  entryZoneLow?: number;
  rr?: number;
  grade?: string;
  confidence?: number;
  thesisType?: string;
  note?: string;
  riskPct?: number;
  // ── ITOS enrichment fields (v2 Pine payloads) — informational; server stays authoritative ──
  entryZoneSource?:           EntryZoneSource;  // coerced to UNKNOWN if invalid
  setupIntent?:               SetupIntent;       // coerced to undefined if invalid
  // Evidence flags
  liquidityEvidence?:         boolean;
  structureEvidence?:         boolean;
  acceptanceEvidence?:        boolean;
  momentumEvidence?:          boolean;
  volumeEvidence?:            boolean;
  trendEvidence?:             boolean;
  // Setup lifecycle metadata
  setupCreatedAt?:            string;
  setupUpdatedAt?:            string;
  setupTimeframe?:            string;
  setupType?:                 string;   // Pine-side label, informational only
  pineTrendAlignment?:        string;   // Pine-side alignment, informational only
  setupAgeMinutes?:           number;
  reversalConfirmationCount?: number;
  [key: string]: unknown;
}

export class SignalValidationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'SignalValidationError';
  }
}

export function validateWebhookSecret(provided: string | null): void {
  const expected = process.env.WEBHOOK_SECRET ?? '';
  if (!expected) return; // no secret configured — open (dev only)
  if (!provided) throw new SignalValidationError('Missing webhook secret');

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new SignalValidationError('Invalid webhook secret');
  }
}

export function parseWebhookPayload(body: unknown): WebhookSignal {
  if (typeof body !== 'object' || body === null) {
    throw new SignalValidationError('Payload must be a JSON object');
  }

  const p = body as Record<string, unknown>;

  if (typeof p.symbol !== 'string' || !p.symbol) {
    throw new SignalValidationError('Missing required field: symbol');
  }
  if (typeof p.signal !== 'string' || !p.signal) {
    throw new SignalValidationError('Missing required field: signal');
  }

  return {
    symbol:        String(p.symbol).toUpperCase(),
    timeframe:     typeof p.timeframe === 'string' ? p.timeframe : '4H',
    signal:        String(p.signal).toUpperCase(),
    setupId:       typeof p.setupId   === 'string'  ? p.setupId   : undefined,
    direction:     typeof p.direction === 'string'  ? p.direction.toUpperCase() : undefined,
    entryPrice:    numOrUndef(p.entryPrice),
    sl:            numOrUndef(p.sl),
    tp1:           numOrUndef(p.tp1),
    tp2:           numOrUndef(p.tp2),
    tp3:           numOrUndef(p.tp3),
    rangeHigh:     numOrUndef(p.rangeHigh),
    rangeLow:      numOrUndef(p.rangeLow),
    entryZoneHigh: numOrUndef(p.entryZoneHigh),
    entryZoneLow:  numOrUndef(p.entryZoneLow),
    rr:            numOrUndef(p.rr),
    grade:         typeof p.grade      === 'string' ? p.grade      : undefined,
    confidence:    typeof p.confidence === 'number' ? p.confidence : undefined,
    thesisType:    typeof p.thesisType === 'string' ? p.thesisType : undefined,
    note:          typeof p.note       === 'string' ? p.note       : undefined,
    riskPct:       numOrUndef(p.riskPct),
    // ── ITOS enrichment fields ────────────────────────────────────────────────
    entryZoneSource: coerceEntryZoneSource(p.entryZoneSource),
    setupIntent:     coerceSetupIntent(p.setupIntent),
    liquidityEvidence:  boolOrFalse(p.liquidityEvidence),
    structureEvidence:  boolOrFalse(p.structureEvidence),
    acceptanceEvidence: boolOrFalse(p.acceptanceEvidence),
    momentumEvidence:   boolOrFalse(p.momentumEvidence),
    volumeEvidence:     boolOrFalse(p.volumeEvidence),
    trendEvidence:      boolOrFalse(p.trendEvidence),
    setupCreatedAt:  typeof p.setupCreatedAt  === 'string' ? p.setupCreatedAt  : undefined,
    setupUpdatedAt:  typeof p.setupUpdatedAt  === 'string' ? p.setupUpdatedAt  : undefined,
    setupTimeframe:  typeof p.setupTimeframe  === 'string' ? p.setupTimeframe  : undefined,
    setupType:       typeof p.setupType       === 'string' ? p.setupType       : undefined,
    pineTrendAlignment: typeof p.pineTrendAlignment === 'string' ? p.pineTrendAlignment : undefined,
    setupAgeMinutes:            numOrUndef(p.setupAgeMinutes),
    reversalConfirmationCount:  numOrUndef(p.reversalConfirmationCount),
  };
}

function coerceSetupIntent(v: unknown): SetupIntent | undefined {
  if (typeof v !== 'string') return undefined;
  const upper = v.toUpperCase() as SetupIntent;
  return VALID_SETUP_INTENTS.has(upper) ? upper : undefined;
}

function coerceEntryZoneSource(v: unknown): EntryZoneSource | undefined {
  if (typeof v !== 'string') return undefined;
  const upper = v.toUpperCase() as EntryZoneSource;
  return VALID_ENTRY_ZONE_SOURCES.has(upper) ? upper : 'UNKNOWN';
}

function boolOrFalse(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === '1' || v === 1) return true;
  return false;
}

function numOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}
