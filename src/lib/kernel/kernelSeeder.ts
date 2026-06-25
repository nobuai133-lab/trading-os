import { prisma }                from '@/lib/db';
import { generateCorrelationId } from '@/core/correlationId';
import { logger }                from '@/core/logger';
import type { CoreStateKernel }  from '@/kernel/KernelAPI';
import type { DashboardState }   from '@/types';
import type { TradePhase }       from '@/kernel/types';

const log = logger.withContext({ service: 'kernel-seeder' });

// Maps SystemState mode + active trade to a TradePhase for the seed event.
function deriveTradePhase(
  mode: string,
  tp1Hit: boolean,
  tp2Hit: boolean,
  tp3Hit: boolean,
  hasTrade: boolean,
): TradePhase {
  if (!hasTrade) {
    if (mode === 'SETUP_DETECTED')   return 'SETUP_DETECTED';
    if (mode === 'WAIT_CONFIRMATION') return 'WAIT_CONFIRMATION';
    if (mode === 'ENTRY_READY')      return 'ENTRY_READY';
    return 'IDLE';
  }
  if (tp3Hit) return 'TP3_REACHED';
  if (tp2Hit) return 'TP2_REACHED';
  if (tp1Hit) return 'TP1_REACHED';
  if (mode === 'POST_TRADE_REVIEW') return 'POSITION_CLOSED';
  if (mode === 'WAIT_NEW_SETUP' || mode === 'COOLDOWN') return 'WAIT_NEW_SETUP';
  return 'POSITION_OPEN';
}

// Seeds the kernel with a single KernelSystemSeeded event derived from current DB state.
// Called once on cold boot (event count = 0). Idempotent — no-ops if already seeded.
export async function seedKernelFromSystemState(kernel: CoreStateKernel): Promise<void> {
  if (kernel.getEventCount() > 0) return;

  log.info('cold boot — seeding kernel from SystemState');

  const [systemStateRow, activeTrade, cooldown, topRange, fingerprint, snapshot] =
    await Promise.all([
      prisma.systemState.findFirst({ orderBy: { updatedAt: 'desc' } }),
      prisma.trade.findFirst({
        where: { status: { notIn: ['CLOSED_WIN', 'CLOSED_LOSS', 'CLOSED_MANUAL', 'EXPIRED', 'INVALIDATED'] } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.cooldown.findFirst({
        where: { active: true, remainingBars: { gt: 0 } },
        orderBy: { activatedAt: 'desc' },
      }),
      prisma.rangeMemory.findFirst({
        where: { symbol: 'BTCUSDT', status: { in: ['ACTIVE', 'TRADED'] } },
        orderBy: { lastTouchedAt: 'desc' },
      }),
      prisma.setupFingerprint.findFirst({
        where: { alreadyTraded: false },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.marketSnapshot.findFirst({
        where: { symbol: 'BTCUSDT', timeframe: '4H' },
        orderBy: { snapshotAt: 'desc' },
      }),
    ]);

  const systemState = systemStateRow?.state as DashboardState | null;
  const mode        = systemState?.mode ?? 'IDLE';
  const hasTrade    = activeTrade !== null;

  const phase = deriveTradePhase(
    mode,
    activeTrade?.tp1Hit ?? false,
    activeTrade?.tp2Hit ?? false,
    activeTrade?.tp3Hit ?? false,
    hasTrade,
  );

  const payload: Record<string, unknown> = {
    // ── Trade domain ──────────────────────────────────────────────────────────
    phase,
    tradeId:    activeTrade?.id,
    direction:  activeTrade?.direction,
    symbol:     'BTCUSDT',
    timeframe:  '4H',
    entry:      activeTrade?.entryPrice   ?? undefined,
    sl:         activeTrade?.sl           ?? undefined,
    tp1:        activeTrade?.tp1          ?? undefined,
    tp2:        activeTrade?.tp2          ?? undefined,
    tp3:        activeTrade?.tp3          ?? undefined,
    tp1Hit:     activeTrade?.tp1Hit       ?? false,
    tp2Hit:     activeTrade?.tp2Hit       ?? false,
    tp3Hit:     activeTrade?.tp3Hit       ?? false,
    riskPct:    activeTrade?.riskPct      ?? 1,
    openedAt:   activeTrade?.createdAt?.toISOString(),

    // ── Lifecycle domain ──────────────────────────────────────────────────────
    mode,
    lifecycleIndex:  systemState?.lifecycleIndex ?? 0,
    cooldownActive:  Boolean(cooldown?.active),
    activeSetupId:   activeTrade?.setupId ?? undefined,

    // ── Memory domain ─────────────────────────────────────────────────────────
    rangeMemory: topRange ? {
      rangeId:            topRange.id,
      status:             topRange.status,
      rangeHigh:          topRange.rangeHigh,
      rangeLow:           topRange.rangeLow,
      freshLiquidity:     topRange.freshLiquidity,
      reentryAllowed:     topRange.reentryAllowed,
      tradeCount:         topRange.tradeCount,
      lastTradeResult:    topRange.lastTradeResult  ?? undefined,
      lastTradeDirection: topRange.lastTradeDirection ?? undefined,
    } : null,
    fingerprint: fingerprint ? {
      id:            fingerprint.id,
      alreadyTraded: fingerprint.alreadyTraded,
      tradedAt:      fingerprint.tradedAt?.toISOString(),
    } : null,
    cooldown: cooldown ? {
      active:        true,
      remainingBars: cooldown.remainingBars,
      totalBars:     cooldown.totalBars,
      activatedAt:   cooldown.activatedAt.toISOString(),
      reason:        cooldown.reason ?? undefined,
    } : { active: false, remainingBars: 0, totalBars: 0 },
    blocked:      Boolean(systemState?.antiReentry?.blocked),
    blockReason:  undefined,
    nextRequired: systemState?.antiReentry?.nextRequiredConditions ?? [],

    // ── Market domain ─────────────────────────────────────────────────────────
    price:    systemState?.price ?? 0,
    provider: 'SystemState',
    ts:       Date.now(),

    // ── Strategy domain ───────────────────────────────────────────────────────
    regime:     systemState?.regime    ?? 'UNKNOWN',
    ema20:      snapshot?.ema20        ?? 0,
    ema50:      snapshot?.ema50        ?? 0,
    atr:        snapshot?.atr          ?? 0,
    confidence: systemState?.confidence ?? 0,
    htfBias:    systemState?.htfBias   ?? 'neutral',
    ltfBias:    systemState?.ltfBias   ?? 'neutral',
    keyLevels:  [],
  };

  await kernel.writeEvent({
    correlationId: generateCorrelationId(),
    source:        'kernel-seeder',
    domain:        'trade',
    type:          'KernelSystemSeeded',
    version:       1,
    payload,
  });

  log.info('kernel seeded', { phase, mode, hasTrade });
}
