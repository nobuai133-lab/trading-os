import { prisma } from './db';
import type {
  DashboardState, Trade, PendingSetup, AntiReentryState,
  RangeMemory, SetupFingerprint, CooldownState,
  TradeStatus, SLStatus, SetupStatus, Decision, Direction,
  TradeGrade, Regime, SystemMode,
} from '@/types';

const EMPTY_TRADE: Trade = {
  direction: '—', grade: '—', status: 'IDLE',
  entry: 0, sl: 0, slCurrent: 0, slStatus: 'N/A',
  tp1: 0, tp2: 0, tp3: 0,
  tp1Hit: false, tp2Hit: false, tp3Hit: false,
  riskPct: 1, rr: 0, sizeBtc: 0, expiryBars: 0, openPct: 0, unrealizedR: 0,
};

export async function buildDashboardState(): Promise<DashboardState> {
  const [activeTrade, pendingSetups, rangeMems, fingerprints, cooldown, snapshot] =
    await Promise.all([
      prisma.trade.findFirst({
        where: { status: { notIn: ['CLOSED_WIN', 'CLOSED_LOSS', 'CLOSED_MANUAL', 'EXPIRED', 'INVALIDATED'] } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.setup.findMany({
        where: { lifecycleStatus: { in: ['NEW', 'ACTIVE'] } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.rangeMemory.findMany({
        orderBy: { lastTouchedAt: 'desc' },
        take: 1,
      }),
      prisma.setupFingerprint.findMany({
        where: { alreadyTraded: false },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }),
      prisma.cooldown.findFirst({
        where: { active: true, remainingBars: { gt: 0 } },
        orderBy: { activatedAt: 'desc' },
      }),
      prisma.marketSnapshot.findFirst({
        where: { symbol: process.env.PRIMARY_SYMBOL ?? 'BTCUSDT' },
        orderBy: { snapshotAt: 'desc' },
      }),
    ]);

  // ── Trade ────────────────────────────────────────────────────────────────────
  let trade: Trade = EMPTY_TRADE;
  let mode: SystemMode = 'IDLE';
  let decision: Decision = 'WAIT';

  if (activeTrade) {
    const price = snapshot?.price ?? activeTrade.entryPrice ?? 0;
    const entry = activeTrade.entryPrice ?? 0;
    const sl    = activeTrade.slCurrent ?? activeTrade.sl ?? 0;
    const openPct = entry > 0 ? ((price - entry) / entry) * 100 : 0;
    const unrealizedR = (entry > 0 && sl !== entry)
      ? (price - entry) / Math.abs(entry - sl) : 0;

    trade = {
      direction:  (activeTrade.direction as Direction) ?? '—',
      grade:      '—',
      status:     activeTrade.status as TradeStatus,
      entry,
      sl:         activeTrade.sl ?? 0,
      slCurrent:  sl,
      slStatus:   activeTrade.slStatus as SLStatus,
      tp1:        activeTrade.tp1 ?? 0,
      tp2:        activeTrade.tp2 ?? 0,
      tp3:        activeTrade.tp3 ?? 0,
      tp1Hit:     activeTrade.tp1Hit,
      tp2Hit:     activeTrade.tp2Hit,
      tp3Hit:     activeTrade.tp3Hit,
      riskPct:    activeTrade.riskPct ?? 1,
      rr:         0,
      sizeBtc:    activeTrade.sizeBtc ?? 0,
      expiryBars: 0,
      openPct,
      unrealizedR,
    };
    mode     = 'ACTIVE_TRADE';
    decision = activeTrade.direction as Decision;
  } else if (pendingSetups.length > 0) {
    mode     = 'SETUP_DETECTED';
    decision = 'WAIT';
  }

  // ── Pending setups ────────────────────────────────────────────────────────────
  const pending: PendingSetup[] = pendingSetups.map((s: typeof pendingSetups[0], i: number) => ({
    id:              s.id,
    label:           `Setup ${String.fromCharCode(65 + i)}`,
    direction:       s.direction as Direction,
    grade:           (s.grade ?? 'B') as TradeGrade,
    entryZone:       { low: s.entryZoneLow ?? 0, high: s.entryZoneHigh ?? 0 },
    sl:              s.sl ?? 0,
    tp1:             s.tp1 ?? 0,
    tp2:             s.tp2 ?? 0,
    tp3:             s.tp3 ?? 0,
    rr:              s.rr ?? 0,
    status:          'WATCHING' as SetupStatus,
    note:            s.note,
    lifecycleStatus: s.lifecycleStatus as any,
    fingerprintId:   s.fingerprintId ?? undefined,
  }));

  // ── Anti-reentry ──────────────────────────────────────────────────────────────
  const rangeMem = rangeMems[0];
  const fp       = fingerprints[0];

  const rangeMemory: RangeMemory | null = rangeMem ? {
    rangeId:           rangeMem.id,
    status:            rangeMem.status as any,
    rangeHigh:         rangeMem.rangeHigh,
    rangeLow:          rangeMem.rangeLow,
    midline:           rangeMem.midline,
    width:             rangeMem.width,
    createdAt:         rangeMem.createdAt.toISOString(),
    lastTouchedAt:     rangeMem.lastTouchedAt.toISOString(),
    tradeCount:        rangeMem.tradeCount,
    lastTradeDirection: rangeMem.lastTradeDirection as Direction | undefined,
    lastTradeResult:   rangeMem.lastTradeResult ?? undefined,
    freshLiquidity:    rangeMem.freshLiquidity,
    reentryAllowed:    rangeMem.reentryAllowed,
  } : null;

  const setupFingerprint: SetupFingerprint | null = fp ? {
    id:                fp.id,
    symbol:            fp.symbol,
    timeframe:         fp.timeframe,
    direction:         fp.direction as Direction,
    rangeHigh:         fp.rangeHigh,
    rangeLow:          fp.rangeLow,
    entryZoneHigh:     fp.entryZoneHigh,
    entryZoneLow:      fp.entryZoneLow,
    thesisType:        fp.thesisType,
    status:            fp.status as any,
    alreadyTraded:     fp.alreadyTraded,
    sameSetupDetected: fp.alreadyTraded,
    lastTradedAt:      fp.tradedAt?.toISOString(),
  } : null;

  const cooldownState: CooldownState = cooldown ? {
    active:        true,
    remainingBars: cooldown.remainingBars,
    totalBars:     cooldown.totalBars,
    activatedAt:   cooldown.activatedAt.toISOString(),
    reason:        cooldown.reason ?? undefined,
  } : { active: false, remainingBars: 0, totalBars: 0 };

  const blocked =
    cooldownState.active ||
    (setupFingerprint?.alreadyTraded ?? false) ||
    rangeMemory?.status === 'STALE' ||
    rangeMemory?.reentryAllowed === false;

  const nextRequired: string[] = [];
  if (cooldownState.active) nextRequired.push(`Wait ${cooldownState.remainingBars} bar(s) cooldown`);
  if (rangeMemory?.status === 'STALE') nextRequired.push('Range must reset with new liquidity sweep');
  if (!rangeMemory?.freshLiquidity) nextRequired.push('Fresh liquidity sweep required');
  if (setupFingerprint?.alreadyTraded) nextRequired.push('New setup fingerprint required');

  if (blocked) mode = 'COOLDOWN';

  const antiReentry: AntiReentryState = {
    rangeMemory,
    setupFingerprint,
    cooldown: cooldownState,
    blocked,
    nextRequiredConditions: nextRequired,
  };

  return {
    symbol:            snapshot?.symbol ?? 'BTCUSDT',
    timeframe:         snapshot?.timeframe ?? '4H',
    price:             snapshot?.price ?? 0,
    mode,
    lifecycleIndex:    activeTrade ? 5 : pendingSetups.length > 0 ? 2 : 0,
    decision,
    confidence:        50,
    confidenceHistory: [],
    decayEvents:       [],
    riskGrade:         'B',
    regime:            (snapshot?.regime as Regime) ?? 'RANGING',
    htfBias:           '—',
    ltfBias:           '—',
    trade,
    pendingSetups:     pending.length > 0 ? pending : undefined,
    antiReentry,
    agents:            [],
    invalidation: {
      price:     { status: 'VALID', trigger: '', impact: '', detail: '' },
      structure: { status: 'VALID', trigger: '', impact: '', detail: '' },
      time:      { status: 'VALID', trigger: '', impact: '', detail: '' },
      thesis:    { status: 'VALID', trigger: '', impact: '', detail: '' },
    },
    thesis: { score: 0, assumptions: [] },
    memory: {
      tradeId: '', direction: '—', timeframe: snapshot?.timeframe ?? '4H',
      entry: 0, tp1: null, tp2: null, tp3: null,
      result: '—', status: 'IDLE', biasCarryover: false,
      lesson: '', mistake: '', currentMode: mode,
    },
    alertMessage: null,
  };
}

export async function persistDashboardState(state: DashboardState): Promise<void> {
  await prisma.systemState.upsert({
    where:  { id: 1 },
    update: { state: state as any },
    create: { id: 1, state: state as any },
  });
}
