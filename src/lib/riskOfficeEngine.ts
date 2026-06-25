import type {
  TradeMemoryRecord, SimilarityResult, DecisionResult,
  RiskOfficeState, RiskOfficeDecision, RiskBudget,
  PortfolioRiskMetrics, RiskOfficeCooldown,
  PositionSizeRecommendation, RiskVeto, RiskOfficeResult,
} from '@/types';

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_RISK_BUDGET: RiskBudget = {
  maxRiskPerTradeR:       1.0,
  maxDailyLossR:          3.0,
  maxWeeklyLossR:         8.0,
  maxMonthlyLossR:       15.0,
  maxConsecutiveLosses:   3,
  maxConsecutiveWins:     6,
  cooldownAfterLossMin:  30,
  cooldownAfterWinMin:   15,
  minConfidenceForTrade: 70,
  maxConcurrentPositions: 2,
  maxSameSymbolPositions: 1,
};

// ── Input ─────────────────────────────────────────────────────────────────────

export interface RiskOfficeInput {
  metrics:         PortfolioRiskMetrics;
  budget:          RiskBudget;
  decision:        DecisionResult | null;
  similarity:      SimilarityResult | null;
  cooldown:        RiskOfficeCooldown;
  providerHealthy: boolean;
  kernelHealthy:   boolean;
  openPositions:   number;
}

// ── Portfolio metrics ─────────────────────────────────────────────────────────

function dayStart(now: Date): Date {
  const d = new Date(now); d.setHours(0, 0, 0, 0); return d;
}

function weekStart(now: Date): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthStart(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function computePortfolioMetrics(
  records: TradeMemoryRecord[],
  now: Date = new Date(),
): PortfolioRiskMetrics {
  const ds = dayStart(now);
  const ws = weekStart(now);
  const ms = monthStart(now);

  const todayRecs = records.filter((r) => new Date(r.closedAt) >= ds);
  const weekRecs  = records.filter((r) => new Date(r.closedAt) >= ws);
  const monthRecs = records.filter((r) => new Date(r.closedAt) >= ms);

  const sumR = (rs: TradeMemoryRecord[]) =>
    parseFloat(rs.reduce((s, r) => s + r.resultR, 0).toFixed(3));

  const dailyPnlR   = sumR(todayRecs);
  const weeklyPnlR  = sumR(weekRecs);
  const monthlyPnlR = sumR(monthRecs);

  const sorted = [...records].sort(
    (a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime(),
  );

  let consecutiveLosses = 0;
  let consecutiveWins   = 0;
  let streak: 'WIN' | 'LOSS' | null = null;

  for (const r of sorted) {
    if (r.outcome === 'BREAK_EVEN') break;
    if (streak === null) {
      streak = r.outcome === 'WIN' ? 'WIN' : 'LOSS';
      if (streak === 'WIN') consecutiveWins = 1; else consecutiveLosses = 1;
    } else if (r.outcome === 'WIN' && streak === 'WIN') {
      consecutiveWins++;
    } else if (r.outcome === 'LOSS' && streak === 'LOSS') {
      consecutiveLosses++;
    } else {
      break;
    }
  }

  const last = sorted[0] ?? null;

  return {
    dailyPnlR,
    weeklyPnlR,
    monthlyPnlR,
    dailyLossR:   Math.max(0, parseFloat((-dailyPnlR).toFixed(3))),
    weeklyLossR:  Math.max(0, parseFloat((-weeklyPnlR).toFixed(3))),
    monthlyLossR: Math.max(0, parseFloat((-monthlyPnlR).toFixed(3))),
    consecutiveLosses,
    consecutiveWins,
    lastOutcome:  last?.outcome ?? null,
    lastClosedAt: last?.closedAt ?? null,
    tradeCountToday: todayRecs.length,
    tradeCountWeek:  weekRecs.length,
    tradeCountMonth: monthRecs.length,
  };
}

// ── Cooldown computation ──────────────────────────────────────────────────────

export function computeRiskCooldown(
  records: TradeMemoryRecord[],
  budget:  RiskBudget,
  now:     Date = new Date(),
): RiskOfficeCooldown {
  const sorted = [...records].sort(
    (a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime(),
  );

  const last = sorted[0];
  if (!last) {
    return { active: false, reason: null, type: null, endsAt: null, remainingMinutes: 0 };
  }

  const closedAt = new Date(last.closedAt);
  const metrics  = computePortfolioMetrics(records, now);

  // Loss cooldown
  if (last.outcome === 'LOSS') {
    const endsAt = new Date(closedAt.getTime() + budget.cooldownAfterLossMin * 60_000);
    if (now < endsAt) {
      const remaining = Math.ceil((endsAt.getTime() - now.getTime()) / 60_000);
      return {
        active: true,
        reason: `Loss cooldown — ${remaining}m remaining`,
        type:   'LOSS',
        endsAt: endsAt.toISOString(),
        remainingMinutes: remaining,
      };
    }
  }

  // Win streak cooldown (anti-overconfidence)
  if (metrics.consecutiveWins >= budget.maxConsecutiveWins && last.outcome === 'WIN') {
    const endsAt = new Date(closedAt.getTime() + budget.cooldownAfterWinMin * 60_000);
    if (now < endsAt) {
      const remaining = Math.ceil((endsAt.getTime() - now.getTime()) / 60_000);
      return {
        active: true,
        reason: `Win streak cooldown (${metrics.consecutiveWins} consecutive wins)`,
        type:   'WIN',
        endsAt: endsAt.toISOString(),
        remainingMinutes: remaining,
      };
    }
  }

  return { active: false, reason: null, type: null, endsAt: null, remainingMinutes: 0 };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function roundTo025(n: number): number {
  return Math.round(n * 4) / 4;
}

function confidenceToBaseR(confidence: number, minConf: number): number {
  if (confidence < Math.max(minConf, 70)) return 0;
  if (confidence >= 95) return 1.00;
  if (confidence >= 90) return 0.75;
  if (confidence >= 80) return 0.50;
  return 0.25; // 70–79
}

function memEdgeMult(similarity: SimilarityResult | null): number {
  if (!similarity || similarity.sampleSize < 3) return 1.0;
  const edge = similarity.winningSimilarity - similarity.losingSimilarity;
  if (edge > 20) return 1.00;
  if (edge >= 0) return 0.90;
  return 0.75;
}

function stateMult(state: RiskOfficeState): number {
  if (state === 'NORMAL')  return 1.00;
  if (state === 'CAUTION') return 0.75;
  if (state === 'REDUCE')  return 0.50;
  return 0; // BLOCK | EMERGENCY_STOP
}

// ── Main computation ──────────────────────────────────────────────────────────

export function computeRiskOffice(input: RiskOfficeInput): RiskOfficeResult {
  const {
    metrics, budget, decision, similarity,
    cooldown, providerHealthy, kernelHealthy, openPositions,
  } = input;

  const vetos: RiskVeto[]           = [];
  const killSwitchReasons: string[] = [];

  // ── Kill switch (hard blocks) ─────────────────────────────────────────────

  if (!kernelHealthy) {
    killSwitchReasons.push('Kernel health degraded');
    vetos.push({ code: 'KS_KERNEL', message: 'Kernel health degraded', severity: 'EMERGENCY' });
  }

  if (!providerHealthy) {
    killSwitchReasons.push('All market data providers offline');
    vetos.push({ code: 'KS_PROVIDER', message: 'No healthy market data provider', severity: 'BLOCK' });
  }

  if (metrics.dailyLossR >= budget.maxDailyLossR) {
    killSwitchReasons.push(`Daily loss ${metrics.dailyLossR.toFixed(2)}R ≥ limit ${budget.maxDailyLossR}R`);
    vetos.push({ code: 'KS_DAILY', message: `Daily loss ${metrics.dailyLossR.toFixed(1)}R — limit reached`, severity: 'BLOCK' });
  }

  if (metrics.weeklyLossR >= budget.maxWeeklyLossR) {
    killSwitchReasons.push(`Weekly loss ${metrics.weeklyLossR.toFixed(2)}R ≥ limit ${budget.maxWeeklyLossR}R`);
    vetos.push({ code: 'KS_WEEKLY', message: `Weekly loss ${metrics.weeklyLossR.toFixed(1)}R — limit reached`, severity: 'BLOCK' });
  }

  if (metrics.monthlyLossR >= budget.maxMonthlyLossR) {
    killSwitchReasons.push(`Monthly loss ${metrics.monthlyLossR.toFixed(2)}R ≥ limit ${budget.maxMonthlyLossR}R`);
    vetos.push({ code: 'KS_MONTHLY', message: `Monthly loss ${metrics.monthlyLossR.toFixed(1)}R — limit reached`, severity: 'BLOCK' });
  }

  if (metrics.consecutiveLosses >= budget.maxConsecutiveLosses) {
    killSwitchReasons.push(`${metrics.consecutiveLosses} consecutive losses ≥ limit ${budget.maxConsecutiveLosses}`);
    vetos.push({ code: 'KS_CONSEC_LOSS', message: `${metrics.consecutiveLosses} consecutive losses — trading halted`, severity: 'BLOCK' });
  }

  const killSwitchActive = killSwitchReasons.length > 0;

  // ── Confidence floor (computed early, needed for risk state) ──────────────

  const confidence = decision?.confidence ?? 0;
  const baseR      = confidenceToBaseR(confidence, budget.minConfidenceForTrade);

  if (baseR === 0 && decision !== null && decision.outcome !== 'NO_TRADE' && decision.outcome !== 'WAIT') {
    vetos.push({
      code:     'BLOCK_LOW_CONF',
      message:  `Confidence ${confidence}% below minimum ${budget.minConfidenceForTrade}%`,
      severity: 'BLOCK',
    });
  }

  // ── Soft warnings and exposure ────────────────────────────────────────────

  const dailyUsedPct   = budget.maxDailyLossR   > 0 ? metrics.dailyLossR   / budget.maxDailyLossR   : 0;
  const weeklyUsedPct  = budget.maxWeeklyLossR  > 0 ? metrics.weeklyLossR  / budget.maxWeeklyLossR  : 0;
  const monthlyUsedPct = budget.maxMonthlyLossR > 0 ? metrics.monthlyLossR / budget.maxMonthlyLossR : 0;

  if (!killSwitchActive) {
    if (dailyUsedPct >= 0.7) {
      vetos.push({ code: 'WARN_DAILY', message: `Daily budget ${(dailyUsedPct * 100).toFixed(0)}% consumed`, severity: 'WARN' });
    } else if (dailyUsedPct >= 0.4) {
      vetos.push({ code: 'INFO_DAILY', message: `Daily budget ${(dailyUsedPct * 100).toFixed(0)}% consumed`, severity: 'WARN' });
    }
    if (weeklyUsedPct >= 0.7) {
      vetos.push({ code: 'WARN_WEEKLY', message: `Weekly budget ${(weeklyUsedPct * 100).toFixed(0)}% consumed`, severity: 'WARN' });
    }
    if (monthlyUsedPct >= 0.7) {
      vetos.push({ code: 'WARN_MONTHLY', message: `Monthly budget ${(monthlyUsedPct * 100).toFixed(0)}% consumed`, severity: 'WARN' });
    }
    if (metrics.consecutiveWins >= budget.maxConsecutiveWins) {
      vetos.push({ code: 'WARN_OVERCONF', message: `${metrics.consecutiveWins} consecutive wins — overconfidence risk`, severity: 'WARN' });
    }
    if (openPositions >= budget.maxConcurrentPositions) {
      vetos.push({ code: 'BLOCK_EXPOSURE', message: `Max concurrent positions (${budget.maxConcurrentPositions}) reached`, severity: 'BLOCK' });
    }
  }

  // Decision outcome blocks
  if (decision === null) {
    vetos.push({ code: 'BLOCK_NO_DECISION', message: 'No decision available', severity: 'BLOCK' });
  } else if (decision.outcome === 'NO_TRADE') {
    vetos.push({ code: 'BLOCK_NO_TRADE', message: 'Decision engine: NO_TRADE', severity: 'BLOCK' });
  } else if (decision.outcome === 'WAIT') {
    vetos.push({ code: 'BLOCK_WAIT', message: 'Decision engine: WAIT', severity: 'BLOCK' });
  }

  // Cooldown block
  if (cooldown.active) {
    vetos.push({ code: 'BLOCK_COOLDOWN', message: cooldown.reason ?? 'Cooldown active', severity: 'BLOCK' });
  }

  // ── Risk state ─────────────────────────────────────────────────────────────

  const hardBlockCount = killSwitchReasons.length;
  const emergencyCount = vetos.filter((v) => v.severity === 'EMERGENCY').length;
  const allHardBlocks  = vetos.filter((v) => v.severity === 'BLOCK' || v.severity === 'EMERGENCY');
  const warnCount      = vetos.filter((v) => v.severity === 'WARN').length;
  const maxUsedPct     = Math.max(dailyUsedPct, weeklyUsedPct, monthlyUsedPct);

  let riskState: RiskOfficeState;

  if (emergencyCount > 0 || hardBlockCount >= 2) {
    riskState = 'EMERGENCY_STOP';
  } else if (allHardBlocks.length > 0) {
    riskState = 'BLOCK';
  } else if (maxUsedPct >= 0.8 || warnCount >= 2) {
    riskState = 'REDUCE';
  } else if (maxUsedPct >= 0.4 || warnCount >= 1) {
    riskState = 'CAUTION';
  } else {
    riskState = 'NORMAL';
  }

  // ── Position sizing ────────────────────────────────────────────────────────

  const memMult   = memEdgeMult(similarity);
  const sMult     = stateMult(riskState);
  const rawFinalR = baseR * memMult * sMult;
  const finalR    = Math.min(roundTo025(rawFinalR), budget.maxRiskPerTradeR);

  const rationale: string[] = [];
  if (confidence < budget.minConfidenceForTrade) {
    rationale.push(`Confidence ${confidence}% < minimum ${budget.minConfidenceForTrade}% — 0R`);
  } else {
    rationale.push(`Confidence ${confidence}% → base ${baseR}R`);
    if (memMult < 1.0) rationale.push(`Memory edge negative → ×${memMult}`);
    if (sMult   < 1.0) rationale.push(`Risk state ${riskState} → ×${sMult}`);
  }

  const positionSize: PositionSizeRecommendation = {
    baseR,
    confidenceMultiplier: baseR,
    memoryEdgeMultiplier: memMult,
    riskStateMultiplier:  sMult,
    finalR,
    rationale,
  };

  // ── Final decision ─────────────────────────────────────────────────────────

  const approvalChain: string[] = [];
  let riskDecision: RiskOfficeDecision;

  const edgeStr = similarity
    ? `${(similarity.winningSimilarity - similarity.losingSimilarity).toFixed(0)}%`
    : 'N/A';

  if (riskState === 'BLOCK' || riskState === 'EMERGENCY_STOP' || finalR === 0) {
    riskDecision = 'BLOCKED';
    const reason = vetos.find((v) => v.severity === 'BLOCK' || v.severity === 'EMERGENCY');
    approvalChain.push(`BLOCKED — ${reason?.message ?? riskState}`);
  } else if (finalR < baseR || riskState !== 'NORMAL') {
    riskDecision = 'REDUCED';
    approvalChain.push('Decision Intelligence ✓');
    approvalChain.push(`Memory edge: ${edgeStr}`);
    approvalChain.push(`Risk Office: REDUCED → ${finalR}R (${riskState})`);
  } else {
    riskDecision = 'APPROVED';
    approvalChain.push('Decision Intelligence ✓');
    approvalChain.push(`Memory edge: ${edgeStr}`);
    approvalChain.push(`Risk Office: APPROVED at ${finalR}R`);
  }

  return {
    decision:          riskDecision,
    riskState,
    positionSize,
    cooldown,
    metrics,
    budget,
    vetos,
    killSwitchActive,
    killSwitchReasons,
    approvalChain,
    computedAt: new Date().toISOString(),
  };
}
