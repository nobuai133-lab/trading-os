import type { KernelFullState, TradePhase, KernelLifecycleMode } from '@/kernel/types';
import type {
  DashboardState, Trade, AntiReentryState, Decision,
  SystemMode, Regime, TradeStatus, Direction, SLStatus, RangeMemory, SetupFingerprint, CooldownState,
} from '@/types';

// ── TradePhase → TradeStatus ──────────────────────────────────────────────────

function phaseToStatus(phase: TradePhase, closeReason?: string): TradeStatus {
  switch (phase) {
    case 'IDLE':              return 'IDLE';
    case 'SETUP_DETECTED':    return 'WAITING';
    case 'WAIT_CONFIRMATION': return 'WAITING';
    case 'ENTRY_READY':       return 'READY';
    case 'POSITION_OPEN':     return 'ACTIVE';
    case 'TP1_REACHED':       return 'TP1_HIT';
    case 'TP2_REACHED':       return 'TP2_HIT';
    case 'TP3_REACHED':       return 'TP3_HIT';
    case 'POSITION_CLOSED':
      if (closeReason === 'SL_HIT') return 'CLOSED_LOSS';
      if (closeReason === 'MANUAL') return 'CLOSED_MANUAL';
      return 'CLOSED_WIN';
    case 'POST_REVIEW':       return 'CLOSED_WIN';
    case 'WAIT_NEW_SETUP':    return 'IDLE';
    default:                  return 'IDLE';
  }
}

// ── KernelLifecycleMode → Decision ────────────────────────────────────────────

function deriveDecision(mode: KernelLifecycleMode, direction?: string): Decision {
  if (mode === 'ACTIVE_TRADE' || mode === 'POST_TRADE_REVIEW') {
    const dir = direction?.toUpperCase();
    if (dir === 'LONG' || dir === 'SHORT') return dir as Decision;
  }
  return 'WAIT';
}

// ── KernelTradeState → DashboardState.trade ───────────────────────────────────

function adaptTrade(kernel: KernelFullState, livePrice: number, base: Trade): Trade {
  const kt = kernel.trade;

  // If kernel says IDLE and no trade context, return empty trade
  if (kt.phase === 'IDLE' && !kt.tradeId) {
    return base; // let base provide last-known state
  }

  const status   = phaseToStatus(kt.phase, kt.closeReason);
  const entry    = kt.entry    ?? base.entry;
  const sl       = kt.sl       ?? base.sl;
  const price    = livePrice > 0 ? livePrice : kernel.market.price;

  const openPct =
    entry > 0 && price > 0
      ? ((price - entry) / entry) * 100
      : base.openPct;

  const unrealizedR =
    entry > 0 && sl > 0 && entry !== sl
      ? (price - entry) / Math.abs(entry - sl)
      : base.unrealizedR;

  return {
    direction:   (kt.direction  as Direction) ?? base.direction,
    grade:       base.grade,        // not in kernel — use legacy
    status,
    entry,
    entryZone:   base.entryZone,    // not in kernel — use legacy
    sl,
    slCurrent:   base.slCurrent,    // trailing SL managed by lifecycle service
    slStatus:    base.slStatus as SLStatus,
    tp1:         kt.tp1      ?? base.tp1,
    tp2:         kt.tp2      ?? base.tp2,
    tp3:         kt.tp3      ?? base.tp3,
    tp1Hit:      kt.tp1Hit,
    tp2Hit:      kt.tp2Hit,
    tp3Hit:      kt.tp3Hit,
    riskPct:     kt.riskPct  ?? base.riskPct,
    rr:          base.rr,           // not in kernel — use legacy
    sizeBtc:     base.sizeBtc,      // not in kernel — use legacy
    expiryBars:  base.expiryBars,   // not in kernel — use legacy
    openPct,
    unrealizedR,
  };
}

// ── KernelMemoryState → AntiReentryState ──────────────────────────────────────

function adaptAntiReentry(kernel: KernelFullState, base: AntiReentryState): AntiReentryState {
  const km = kernel.memory;

  const rangeMemory: RangeMemory | null = km.rangeMemory ? {
    rangeId:            km.rangeMemory.rangeId,
    status:             km.rangeMemory.status as RangeMemory['status'],
    rangeHigh:          km.rangeMemory.rangeHigh,
    rangeLow:           km.rangeMemory.rangeLow,
    midline:            (km.rangeMemory.rangeHigh + km.rangeMemory.rangeLow) / 2,
    width:              km.rangeMemory.rangeHigh - km.rangeMemory.rangeLow,
    createdAt:          base.rangeMemory?.createdAt ?? new Date().toISOString(),
    lastTouchedAt:      base.rangeMemory?.lastTouchedAt ?? new Date().toISOString(),
    tradeCount:         km.rangeMemory.tradeCount,
    lastTradeDirection: km.rangeMemory.lastTradeDirection as Direction | undefined,
    lastTradeResult:    km.rangeMemory.lastTradeResult,
    freshLiquidity:     km.rangeMemory.freshLiquidity,
    reentryAllowed:     km.rangeMemory.reentryAllowed,
  } : null;

  const setupFingerprint: SetupFingerprint | null = km.fingerprint ? {
    id:                km.fingerprint.id,
    symbol:            'BTCUSDT',
    timeframe:         '4H',
    direction:         base.setupFingerprint?.direction ?? 'LONG',
    rangeHigh:         base.setupFingerprint?.rangeHigh ?? 0,
    rangeLow:          base.setupFingerprint?.rangeLow ?? 0,
    entryZoneHigh:     base.setupFingerprint?.entryZoneHigh ?? 0,
    entryZoneLow:      base.setupFingerprint?.entryZoneLow ?? 0,
    thesisType:        base.setupFingerprint?.thesisType ?? '',
    status:            base.setupFingerprint?.status ?? 'ACTIVE',
    alreadyTraded:     km.fingerprint.alreadyTraded,
    sameSetupDetected: km.fingerprint.alreadyTraded,
    lastTradedAt:      km.fingerprint.tradedAt,
  } : null;

  const cooldown: CooldownState = {
    active:        km.cooldown.active,
    remainingBars: km.cooldown.remainingBars,
    totalBars:     km.cooldown.totalBars,
    activatedAt:   km.cooldown.activatedAt,
    reason:        km.cooldown.reason,
  };

  return {
    rangeMemory,
    setupFingerprint,
    cooldown,
    blocked:                 km.blocked,
    overrideReason:          undefined,
    nextRequiredConditions:  km.nextRequired,
  };
}

// ── computeRiskGrade ──────────────────────────────────────────────────────────

function computeRiskGrade(confidence: number): string {
  if (confidence >= 70) return 'A';
  if (confidence >= 50) return 'B';
  return 'C';
}

// ── Main adapter ──────────────────────────────────────────────────────────────

// Overlays kernel-authoritative fields onto the legacy base DashboardState.
// Fields not yet in the kernel (agents, confidenceHistory, etc.) fall through from base.
// Fields where kernel has default/zero values fall through from base.
export function adaptKernelState(
  kernel: KernelFullState,
  base: DashboardState,
): DashboardState {
  const kLife     = kernel.lifecycle;
  const kStrategy = kernel.strategy;
  const kMarket   = kernel.market;

  const mode: SystemMode = kLife.mode as SystemMode;
  const direction        = kernel.trade.direction;
  const decision: Decision = deriveDecision(kLife.mode, direction);
  const livePrice        = kMarket.price > 0 ? kMarket.price : base.price;
  const trade            = adaptTrade(kernel, livePrice, base.trade);
  const antiReentry      = adaptAntiReentry(kernel, base.antiReentry ?? {
    rangeMemory: null, setupFingerprint: null,
    cooldown: { active: false, remainingBars: 0, totalBars: 0 },
    blocked: false, nextRequiredConditions: [],
  });

  const confidence =
    kStrategy.confidence > 0 ? kStrategy.confidence : base.confidence;

  return {
    ...base,
    // ── Kernel-authoritative overrides ────────────────────────────────────────
    mode,
    lifecycleIndex:  kLife.lifecycleIndex,
    decision,
    price:           livePrice,
    trade,
    antiReentry,
    // ── Strategy fields — kernel wins when non-default ────────────────────────
    regime:          (kStrategy.regime && kStrategy.regime !== 'UNKNOWN')
                       ? kStrategy.regime as Regime : base.regime,
    htfBias:         kStrategy.htfBias !== 'neutral' ? kStrategy.htfBias : base.htfBias,
    ltfBias:         kStrategy.ltfBias !== 'neutral' ? kStrategy.ltfBias : base.ltfBias,
    confidence,
    keyLevels:       kStrategy.keyLevels.length > 0
                       ? kStrategy.keyLevels as DashboardState['keyLevels'] : base.keyLevels,
    riskGrade:       computeRiskGrade(confidence),
    // ── Fields that remain from base (not yet in kernel) ──────────────────────
    // agents, confidenceHistory, decayEvents, invalidation, thesis, memory, pendingSetups
  };
}
