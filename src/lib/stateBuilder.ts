import { prisma } from './db';
import { fetchOHLCV, fetchCurrentPrice, marketDataEngine } from './marketData';
import { runStrategyAnalysis, deriveHtfBias } from './strategyEngine';
import { classifySetup } from './setupClassifier';
import { assessSetupValidity, applyGradeCap } from './setupValidityEngine';
import type {
  DashboardState, Trade, PendingSetup, AntiReentryState,
  RangeMemory, SetupFingerprint, CooldownState, KeyLevel,
  TradeStatus, SLStatus, SetupStatus, Decision, Direction,
  TradeGrade, Regime, SystemMode, AgentReport, AgentType,
  MarketDataStatus, MarketDataBadge,
} from '@/types';

const EMPTY_TRADE: Trade = {
  direction: '—', grade: '—', status: 'IDLE',
  entry: 0, sl: 0, slCurrent: 0, slStatus: 'N/A',
  tp1: 0, tp2: 0, tp3: 0,
  tp1Hit: false, tp2Hit: false, tp3Hit: false,
  riskPct: 1, rr: 0, sizeBtc: 0, expiryBars: 0, openPct: 0, unrealizedR: 0,
};

export async function buildDashboardState(): Promise<DashboardState> {
  // ── Fetch live price + 4H analysis in parallel with DB queries ───────────────
  const [
    activeTrade, pendingSetups, rangeMems, fingerprints, cooldown,
    snapshot4H, snapshot1D, recentTrade,
  ] = await Promise.all([
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
      where: { symbol: 'BTCUSDT', status: { in: ['ACTIVE', 'TRADED'] } },
      orderBy: { lastTouchedAt: 'desc' },
      take: 10,
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
      where: { symbol: 'BTCUSDT', timeframe: '4H' },
      orderBy: { snapshotAt: 'desc' },
    }),
    prisma.marketSnapshot.findFirst({
      where: { symbol: 'BTCUSDT', timeframe: '1D' },
      orderBy: { snapshotAt: 'desc' },
    }),
    prisma.trade.findFirst({
      where: { status: { in: ['CLOSED_WIN', 'CLOSED_LOSS', 'CLOSED_MANUAL'] } },
      orderBy: { closedAt: 'desc' },
    }),
  ]);

  // ── Fetch live price + fresh analysis (non-blocking fallback) ────────────────
  let livePrice   = snapshot4H?.price ?? 0;
  let regime4H: Regime = (snapshot4H?.regime as Regime) ?? 'RANGING';
  let regime1D: Regime = (snapshot1D?.regime as Regime) ?? 'RANGING';
  let ema20       = snapshot4H?.ema20 ?? 0;
  let ema50       = snapshot4H?.ema50 ?? 0;
  let atrVal      = snapshot4H?.atr   ?? 0;
  let keyLevels: KeyLevel[] = [];
  let confidence  = 50;

  // Provenance tracking
  let priceProvider       = 'db-fallback';
  let priceBasis: 'PERP' | 'SPOT' = 'SPOT';
  let analysisTimestamp   = snapshot4H?.snapshotAt?.toISOString() ?? new Date(0).toISOString();
  let latestClosedCandleTs = analysisTimestamp;

  try {
    const [bars, price] = await Promise.all([
      fetchOHLCV('BTCUSDT', '4H', 720),
      fetchCurrentPrice('BTCUSDT'),
    ]);
    livePrice       = price;
    priceProvider   = marketDataEngine.getActiveProvider();
    priceBasis      = marketDataEngine.getActiveProviderBasis();
    analysisTimestamp = new Date().toISOString();
    if (bars.length > 0) {
      latestClosedCandleTs = new Date(bars[bars.length - 1].openTime).toISOString();
    }
    const analysis = runStrategyAnalysis(bars, '4H');
    regime4H   = analysis.regime;
    ema20      = analysis.ema20;
    ema50      = analysis.ema50;
    atrVal     = analysis.atr;
    confidence = analysis.confidence;
    keyLevels  = analysis.keyLevels as KeyLevel[];

    // Also get 1D regime for htfBias
    try {
      const bars1D = await fetchOHLCV('BTCUSDT', '1D', 200);
      const a1D    = runStrategyAnalysis(bars1D, '1D');
      regime1D     = a1D.regime;
    } catch { /* use DB snapshot fallback */ }
  } catch { /* use DB snapshot fallback */ }

  // ── Market data status (provenance + freshness) ───────────────────────────────
  const nowMs               = Date.now();
  const analysisAgeSeconds  = Math.round((nowMs - new Date(analysisTimestamp).getTime()) / 1000);
  const candleAgeSeconds    = Math.round((nowMs - new Date(latestClosedCandleTs).getTime()) / 1000);
  const CANDLE_4H_STALE_S   = 5 * 3600; // 5 hours = one 4H candle + buffer
  const ANALYSIS_STALE_S    = 60;

  const isTickerFresh   = priceProvider !== 'db-fallback';
  const isCandleFresh   = candleAgeSeconds < CANDLE_4H_STALE_S;
  const isAnalysisFresh = analysisAgeSeconds < ANALYSIS_STALE_S;

  let badge: MarketDataBadge;
  let marketWarning: string | undefined;
  if (!isTickerFresh) {
    badge = 'STALE';
    marketWarning = `Using cached snapshot (${Math.round(analysisAgeSeconds / 60)}m old)`;
  } else if (!isCandleFresh) {
    badge = 'CANDLE_CLOSED';
    marketWarning = `Latest 4H candle is ${Math.round(candleAgeSeconds / 3600)}h old`;
  } else {
    badge = 'LIVE';
  }

  const fallbackActive = priceBasis === 'SPOT' && priceProvider !== 'db-fallback';

  const marketDataStatus: MarketDataStatus = {
    provider:              priceProvider,
    candleProvider:        priceProvider,
    symbol:                'BTCUSDT',
    timeframe:             '4H',
    latestPrice:           livePrice,
    latestPriceTimestamp:  new Date().toISOString(),
    latestClosedCandleTs,
    candleAgeSeconds,
    analysisAgeSeconds,
    isTickerFresh,
    isCandleFresh,
    isAnalysisFresh,
    badge,
    warning:               marketWarning,
    priceBasis,
    fallbackActive,
    tradedSymbol:          'BTCUSDT',
    tradedExchange:        priceBasis === 'PERP' ? priceProvider : 'binance-futures (target)',
    referenceMarket:       priceBasis === 'PERP' ? 'perpetual' : 'spot',
    basisWarning:          fallbackActive ? `Spot reference (${priceProvider}) — may differ from BTCUSDT perpetual` : undefined,
  };

  const htfBias = deriveHtfBias(regime1D as any);
  const ltfBias = deriveHtfBias(regime4H as any);

  // ── Agents ────────────────────────────────────────────────────────────────────
  const agents: AgentReport[] = buildAgents(regime4H, regime1D, ema20, ema50, livePrice, atrVal);

  // ── Confidence history (last 10 snapshots) ────────────────────────────────────
  const snapHistory = await prisma.marketSnapshot.findMany({
    where: { symbol: 'BTCUSDT', timeframe: '4H' },
    orderBy: { snapshotAt: 'desc' },
    take: 10,
    select: { atr: true, ema20: true, ema50: true, regime: true },
  });
  const confidenceHistory = snapHistory.reverse().map((s) => {
    let score = 30;
    if (s.regime !== 'UNKNOWN' && s.regime !== null) score += 15;
    if (s.regime === 'TRENDING_UP' || s.regime === 'TRENDING_DOWN') score += 20;
    if (s.ema20 && s.ema50) {
      const diff = Math.abs(s.ema20 - s.ema50) / s.ema50;
      if (diff > 0.02) score += 35;
      else if (diff > 0.01) score += 20;
    }
    return Math.min(score, 100);
  });

  // ── Trade ─────────────────────────────────────────────────────────────────────
  let trade: Trade = EMPTY_TRADE;
  let mode: SystemMode = 'IDLE';
  let decision: Decision = 'WAIT';

  if (activeTrade) {
    const entry   = activeTrade.entryPrice ?? 0;
    const sl      = activeTrade.slCurrent  ?? activeTrade.sl ?? 0;
    const openPct = entry > 0 ? ((livePrice - entry) / entry) * 100 : 0;
    const unrealizedR = entry > 0 && sl !== entry
      ? (livePrice - entry) / Math.abs(entry - sl) : 0;

    trade = {
      direction:   (activeTrade.direction as Direction) ?? '—',
      grade:       '—',
      status:      activeTrade.status as TradeStatus,
      entry,
      sl:          activeTrade.sl        ?? 0,
      slCurrent:   sl,
      slStatus:    activeTrade.slStatus  as SLStatus,
      tp1:         activeTrade.tp1       ?? 0,
      tp2:         activeTrade.tp2       ?? 0,
      tp3:         activeTrade.tp3       ?? 0,
      tp1Hit:      activeTrade.tp1Hit,
      tp2Hit:      activeTrade.tp2Hit,
      tp3Hit:      activeTrade.tp3Hit,
      riskPct:     activeTrade.riskPct   ?? 1,
      rr:          0,
      sizeBtc:     activeTrade.sizeBtc   ?? 0,
      expiryBars:  0,
      openPct,
      unrealizedR,
    };
    mode     = 'ACTIVE_TRADE';
    decision = activeTrade.direction as Decision;
  } else if (pendingSetups.length > 0) {
    mode     = 'SETUP_DETECTED';
    decision = 'WAIT';
  }

  // ── Pending setups — assess validity and filter INVALID ──────────────────────
  const rawPending = pendingSetups.map((s) => {
    const dir      = s.direction as Direction;
    const classi   = classifySetup(dir, htfBias, ltfBias);
    const validity = assessSetupValidity({
      htfBias,
      ltfBias,
      regime:        regime4H,
      currentPrice:  livePrice,
      direction:     dir,
      entryZoneLow:  s.entryZoneLow  ?? 0,
      entryZoneHigh: s.entryZoneHigh ?? 0,
      createdAt:     s.createdAt,
      timeframe:     s.timeframe ?? '4H',
      signalGrade:   s.grade ?? 'B',
    });
    return { s, dir, classi, validity };
  });

  // INVALID setups are completely filtered — EXPIRED and WATCH_ONLY are kept but labeled
  const filteredPending = rawPending.filter(({ validity }) => validity.validity !== 'INVALID');

  const pending: PendingSetup[] = filteredPending.map(({ s, dir, classi, validity }, i) => {
    // Cap grade based on validity assessment (gradeCap is a ceiling)
    const effectiveGrade = applyGradeCap(s.grade ?? 'B', validity.gradeCap);
    return {
      id:              s.id,
      label:           `Setup ${String.fromCharCode(65 + i)}`,
      direction:       dir,
      grade:           effectiveGrade,
      entryZone:       { low: s.entryZoneLow ?? 0, high: s.entryZoneHigh ?? 0 },
      sl:              s.sl  ?? 0,
      tp1:             s.tp1 ?? 0,
      tp2:             s.tp2 ?? 0,
      tp3:             s.tp3 ?? 0,
      rr:              s.rr  ?? 0,
      status:          validity.blocked ? 'WATCHING' as SetupStatus : 'WATCHING' as SetupStatus,
      note:            s.note,
      lifecycleStatus: validity.validity === 'EXPIRED' ? 'EXPIRED' : s.lifecycleStatus as any,
      fingerprintId:   s.fingerprintId  ?? undefined,
      classification:  classi,
      validity,
      createdAt:       s.createdAt.toISOString(),
    };
  });

  // ── Anti-reentry ──────────────────────────────────────────────────────────────
  const topRange  = rangeMems[0];
  const fp        = fingerprints[0];

  const rangeMemory: RangeMemory | null = topRange ? {
    rangeId:            topRange.id,
    status:             topRange.status as any,
    rangeHigh:          topRange.rangeHigh,
    rangeLow:           topRange.rangeLow,
    midline:            topRange.midline,
    width:              topRange.width,
    createdAt:          topRange.createdAt.toISOString(),
    lastTouchedAt:      topRange.lastTouchedAt.toISOString(),
    tradeCount:         topRange.tradeCount,
    lastTradeDirection: topRange.lastTradeDirection as Direction | undefined,
    lastTradeResult:    topRange.lastTradeResult    ?? undefined,
    freshLiquidity:     topRange.freshLiquidity,
    reentryAllowed:     topRange.reentryAllowed,
  } : null;

  const setupFingerprint: SetupFingerprint | null = fp ? {
    id:                fp.id,
    symbol:            fp.symbol,
    timeframe:         fp.timeframe,
    direction:         fp.direction  as Direction,
    rangeHigh:         fp.rangeHigh,
    rangeLow:          fp.rangeLow,
    entryZoneHigh:     fp.entryZoneHigh,
    entryZoneLow:      fp.entryZoneLow,
    thesisType:        fp.thesisType,
    status:            fp.status     as any,
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
    rangeMemory, setupFingerprint, cooldown: cooldownState,
    blocked, nextRequiredConditions: nextRequired,
  };

  // ── Memory record ─────────────────────────────────────────────────────────────
  const memory = {
    tradeId:       recentTrade?.id        ?? '',
    direction:     (recentTrade?.direction as Direction) ?? '—',
    timeframe:     '4H',
    entry:         recentTrade?.entryPrice ?? 0,
    tp1:           recentTrade?.tp1        ?? null,
    tp2:           recentTrade?.tp2        ?? null,
    tp3:           recentTrade?.tp3        ?? null,
    result:        recentTrade?.closeReason ?? '—',
    status:        (recentTrade?.status    ?? 'IDLE') as TradeStatus,
    biasCarryover: false,
    lesson:        recentTrade?.lesson     ?? '',
    mistake:       recentTrade?.mistake    ?? '',
    currentMode:   mode,
  };

  return {
    symbol:            'BTCUSDT',
    timeframe:         '4H',
    price:             livePrice,
    mode,
    lifecycleIndex:    activeTrade ? 5 : pendingSetups.length > 0 ? 2 : 0,
    decision,
    confidence,
    confidenceHistory,
    decayEvents:       [],
    riskGrade:         confidence >= 70 ? 'A' : confidence >= 50 ? 'B' : 'C',
    regime:            regime4H,
    htfBias,
    ltfBias,
    trade,
    pendingSetups:     pending.length > 0 ? pending : undefined,
    antiReentry,
    keyLevels:         keyLevels.length > 0 ? keyLevels : undefined,
    agents,
    invalidation: {
      price:     { status: 'VALID', trigger: '', impact: '', detail: '' },
      structure: { status: 'VALID', trigger: '', impact: '', detail: '' },
      time:      { status: 'VALID', trigger: '', impact: '', detail: '' },
      thesis:    { status: 'VALID', trigger: '', impact: '', detail: '' },
    },
    thesis: { score: confidence, assumptions: [] },
    memory,
    alertMessage: null,
    marketDataStatus,
  };
}

// ── Synthetic agents from analysis data ──────────────────────────────────────

function buildAgents(
  regime4H: Regime,
  regime1D: Regime,
  ema20: number,
  ema50: number,
  price: number,
  atr: number,
): AgentReport[] {
  const agents: AgentReport[] = [];

  // Trend agent
  const trendType: AgentType =
    regime4H === 'TRENDING_UP'   ? 'bullish' :
    regime4H === 'TRENDING_DOWN' ? 'bearish' : 'neutral';
  agents.push({
    id:     'trend',
    label:  'Trend',
    status: regime4H,
    type:   trendType,
  });

  // EMA alignment agent
  const emaAligned = ema20 > 0 && ema50 > 0;
  const emaBull    = emaAligned && ema20 > ema50;
  const emaDiff    = emaAligned ? Math.abs(ema20 - ema50) / ema50 : 0;
  const emaStrong  = emaDiff > 0.01;
  agents.push({
    id:     'ema',
    label:  'EMA Alignment',
    status: !emaAligned ? 'N/A' : emaBull ? `EMA20 > EMA50 ${emaStrong ? '(strong)' : '(weak)'}` : `EMA20 < EMA50 ${emaStrong ? '(strong)' : '(weak)'}`,
    type:   !emaAligned ? 'neutral' : emaBull ? 'bullish' : 'bearish',
  });

  // HTF bias agent
  const htfType: AgentType =
    regime1D === 'TRENDING_UP'   ? 'bullish' :
    regime1D === 'TRENDING_DOWN' ? 'bearish' : 'neutral';
  agents.push({
    id:     'htf',
    label:  'HTF Bias (1D)',
    status: regime1D,
    type:   htfType,
  });

  // Volatility agent
  const atrPct    = atr > 0 && price > 0 ? (atr / price) * 100 : 0;
  const volType: AgentType = atrPct > 2 ? 'warning' : atrPct > 1 ? 'neutral' : 'valid';
  agents.push({
    id:     'volatility',
    label:  'Volatility (ATR)',
    status: atr > 0 ? `ATR $${atr.toFixed(0)} (${atrPct.toFixed(2)}%)` : 'N/A',
    type:   volType,
  });

  return agents;
}

export async function persistDashboardState(state: DashboardState): Promise<void> {
  await prisma.systemState.upsert({
    where:  { id: 1 },
    update: { state: state as any },
    create: { id: 1, state: state as any },
  });
}
