import { timingSafeEqual } from 'crypto';

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
  };
}

function numOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}
