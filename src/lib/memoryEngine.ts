import { prisma } from './db';
import { logger } from './logger';
import type { WebhookSignal } from './signalProvider';

// ── Duplicate webhook detection ───────────────────────────────────────────────

export async function isDuplicateWebhook(
  setupId: string,
  windowMs = 60_000,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const existing = await prisma.webhookEvent.findFirst({
    where: {
      setupId,
      receivedAt: { gte: since },
      processed:  true,
    },
  });
  return !!existing;
}

// ── Range memory ──────────────────────────────────────────────────────────────

function rangeId(symbol: string, timeframe: string, high: number, low: number): string {
  return `${symbol}-${timeframe}-${high}-${low}`;
}

export async function getOrCreateRange(signal: WebhookSignal) {
  const { symbol, timeframe, rangeHigh, rangeLow } = signal;
  if (!rangeHigh || !rangeLow) return null;

  const id = rangeId(symbol, timeframe, rangeHigh, rangeLow);
  const midline = (rangeHigh + rangeLow) / 2;
  const width   = rangeHigh - rangeLow;

  const existing = await prisma.rangeMemory.findUnique({ where: { id } });
  if (existing) return existing;

  return prisma.rangeMemory.create({
    data: { id, symbol, timeframe, rangeHigh, rangeLow, midline, width },
  });
}

export async function markRangeTraded(
  symbol: string,
  timeframe: string,
  rangeHigh: number,
  rangeLow: number,
  direction: string,
  result: string,
) {
  const id = rangeId(symbol, timeframe, rangeHigh, rangeLow);
  await prisma.rangeMemory.update({
    where: { id },
    data: {
      status:             'TRADED',
      tradeCount:         { increment: 1 },
      lastTradeDirection: direction,
      lastTradeResult:    result,
      freshLiquidity:     false,
      reentryAllowed:     false,
      lastTouchedAt:      new Date(),
    },
  });
}

export async function resetRangeLiquidity(
  symbol: string,
  timeframe: string,
  rangeHigh: number,
  rangeLow: number,
) {
  const id = rangeId(symbol, timeframe, rangeHigh, rangeLow);
  await prisma.rangeMemory.update({
    where: { id },
    data: {
      freshLiquidity: true,
      reentryAllowed: true,
      status:         'RESET',
      lastTouchedAt:  new Date(),
    },
  });
}

// ── Setup fingerprint ─────────────────────────────────────────────────────────

function fingerprintId(signal: WebhookSignal): string {
  const { symbol, timeframe, direction = '', rangeHigh = 0, rangeLow = 0,
          entryZoneHigh = 0, entryZoneLow = 0 } = signal;
  return `${symbol}-${timeframe}-${direction}-RH${rangeHigh}-RL${rangeLow}-EH${entryZoneHigh}-EL${entryZoneLow}`;
}

export async function getOrCreateFingerprint(signal: WebhookSignal) {
  const id = fingerprintId(signal);

  const existing = await prisma.setupFingerprint.findUnique({ where: { id } });
  if (existing) {
    logger.debug('fingerprint hit', { id, alreadyTraded: existing.alreadyTraded });
    return existing;
  }

  return prisma.setupFingerprint.create({
    data: {
      id,
      symbol:        signal.symbol,
      timeframe:     signal.timeframe,
      direction:     signal.direction ?? '',
      rangeHigh:     signal.rangeHigh     ?? 0,
      rangeLow:      signal.rangeLow      ?? 0,
      entryZoneHigh: signal.entryZoneHigh ?? 0,
      entryZoneLow:  signal.entryZoneLow  ?? 0,
      thesisType:    signal.thesisType    ?? '',
    },
  });
}

export async function markFingerprintTraded(id: string, result: string) {
  await prisma.setupFingerprint.update({
    where: { id },
    data: {
      alreadyTraded: true,
      tradedAt:      new Date(),
      result,
      status:        'TRADED',
    },
  });
}

// ── Cooldown engine ───────────────────────────────────────────────────────────

export async function createCooldown(
  symbol: string,
  timeframe: string,
  direction: string | null,
  totalBars: number,
  reason: string,
) {
  return prisma.cooldown.create({
    data: {
      symbol,
      timeframe,
      direction: direction ?? null,
      totalBars,
      remainingBars: totalBars,
      reason,
    },
  });
}

export async function getActiveCooldown(symbol: string, timeframe: string) {
  return prisma.cooldown.findFirst({
    where: { symbol, timeframe, active: true, remainingBars: { gt: 0 } },
    orderBy: { activatedAt: 'desc' },
  });
}

export async function decrementCooldown(id: number) {
  const updated = await prisma.cooldown.update({
    where: { id },
    data: { remainingBars: { decrement: 1 } },
  });
  if (updated.remainingBars <= 0) {
    await prisma.cooldown.update({ where: { id }, data: { active: false } });
  }
  return updated;
}

// ── Stale range detection ─────────────────────────────────────────────────────

export async function markStaleRanges(olderThanMs = 7 * 24 * 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await prisma.rangeMemory.updateMany({
    where: {
      lastTouchedAt: { lt: cutoff },
      status:        { notIn: ['STALE', 'RESET'] },
    },
    data: { status: 'STALE' },
  });
  logger.info('markStaleRanges', { updated: result.count });
}

// ── Webhook event log ─────────────────────────────────────────────────────────

export async function logWebhookEvent(data: {
  symbol?: string;
  signal?: string;
  setupId?: string;
  payload: object;
  processed: boolean;
  duplicate: boolean;
  blocked: boolean;
  blockReason?: string;
  error?: string;
}) {
  return prisma.webhookEvent.create({ data });
}
