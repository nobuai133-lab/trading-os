'use client';

import GlassCard              from '@/components/ui/GlassCard';
import { useRiskOfficeFeed }  from '@/hooks/useRiskOfficeFeed';
import type { RiskOfficeState, RiskOfficeDecision, RiskVeto } from '@/types';

// ── Style helpers ─────────────────────────────────────────────────────────────

const STATE_COLORS: Record<RiskOfficeState, string> = {
  NORMAL:         '#00E5A8',
  CAUTION:        '#FBBF24',
  REDUCE:         '#F97316',
  BLOCK:          '#FF3B5C',
  EMERGENCY_STOP: '#FF0040',
};

const DECISION_COLORS: Record<RiskOfficeDecision, string> = {
  APPROVED: '#00E5A8',
  REDUCED:  '#FBBF24',
  BLOCKED:  '#FF3B5C',
};

function RBar({ label, used, max, color }: { label: string; used: number; max: number; color: string }) {
  const safeUsed = used ?? 0;
  const safeMax  = max  ?? 0;
  const pct = safeMax > 0 ? Math.min(100, (safeUsed / safeMax) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[10px] text-muted">{label}</span>
        <span className="text-[10px] tabular-nums" style={{ color }}>
          {safeUsed >= 0 ? '+' : ''}{safeUsed.toFixed(1)}R / {safeMax}R
        </span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(71,85,105,0.25)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Number.isFinite(pct) ? pct : 0}%`, background: color }}
        />
      </div>
    </div>
  );
}

function VetoRow({ veto }: { veto: RiskVeto }) {
  const col = veto.severity === 'EMERGENCY' ? '#FF0040'
    : veto.severity === 'BLOCK' ? '#FF3B5C'
    : '#FBBF24';
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-[9px] font-bold mt-0.5 shrink-0" style={{ color: col }}>
        {veto.severity === 'EMERGENCY' ? '⛔' : veto.severity === 'BLOCK' ? '✗' : '⚠'}
      </span>
      <span className="text-[10px] leading-snug text-muted">{veto.message}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RiskOfficePanel() {
  const { result, loading, error } = useRiskOfficeFeed();

  if (loading && !result) {
    return (
      <GlassCard>
        <p className="card-title">Risk Office</p>
        <p className="text-[11px] text-muted2 mt-2">Initializing…</p>
      </GlassCard>
    );
  }

  if (error && !result) {
    return (
      <GlassCard>
        <p className="card-title">Risk Office</p>
        <p className="text-[11px] text-danger mt-2">Unavailable — {error}</p>
      </GlassCard>
    );
  }

  if (!result) return null;

  const { riskState, decision, positionSize, cooldown, metrics, budget, vetos, killSwitchActive, approvalChain } = result;

  if (!metrics || !budget || !vetos) return null;

  const stateCol    = STATE_COLORS[riskState]    ?? '#94A3B8';
  const decisionCol = DECISION_COLORS[decision]  ?? '#94A3B8';

  const dailyLossUsedPct   = budget.maxDailyLossR   > 0 ? (metrics.dailyLossR   ?? 0) / budget.maxDailyLossR   : 0;
  const weeklyLossUsedPct  = budget.maxWeeklyLossR  > 0 ? (metrics.weeklyLossR  ?? 0) / budget.maxWeeklyLossR  : 0;
  const monthlyLossUsedPct = budget.maxMonthlyLossR > 0 ? (metrics.monthlyLossR ?? 0) / budget.maxMonthlyLossR : 0;

  const dailyColor   = dailyLossUsedPct   >= 1 ? '#FF3B5C' : dailyLossUsedPct   >= 0.7 ? '#F97316' : '#00E5A8';
  const weeklyColor  = weeklyLossUsedPct  >= 1 ? '#FF3B5C' : weeklyLossUsedPct  >= 0.7 ? '#F97316' : '#00E5A8';
  const monthlyColor = monthlyLossUsedPct >= 1 ? '#FF3B5C' : monthlyLossUsedPct >= 0.7 ? '#F97316' : '#00E5A8';

  const actionableVetos = vetos.filter((v) => v.severity !== 'WARN');
  const warnVetos       = vetos.filter((v) => v.severity === 'WARN');

  return (
    <GlassCard>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="card-title mb-0">Risk Office</p>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-chip tracking-wider uppercase"
            style={{ color: stateCol, background: `${stateCol}18`, border: `1px solid ${stateCol}30` }}
          >
            {riskState.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Kill switch banner */}
      {killSwitchActive && (
        <div
          className="mb-3 px-2 py-1.5 rounded-badge text-[10px] font-bold text-center"
          style={{ background: 'rgba(255,59,92,0.12)', border: '1px solid rgba(255,59,92,0.3)', color: '#FF3B5C' }}
        >
          ⛔ KILL SWITCH ACTIVE
        </div>
      )}

      {/* Decision + position size */}
      <div
        className="mb-3 px-3 py-2 rounded-badge flex items-center justify-between"
        style={{ background: `${decisionCol}08`, border: `1px solid ${decisionCol}25` }}
      >
        <div>
          <div className="text-[9px] text-muted2 uppercase tracking-wider mb-0.5">Outcome</div>
          <div className="text-[13px] font-black tracking-wide" style={{ color: decisionCol }}>
            {decision}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-muted2 uppercase tracking-wider mb-0.5">Size</div>
          <div className="text-[20px] font-black tabular-nums leading-none" style={{ color: decisionCol }}>
            {positionSize.finalR > 0 ? `${positionSize.finalR}R` : '—'}
          </div>
        </div>
      </div>

      {/* Position size breakdown */}
      {positionSize.finalR > 0 && (
        <div className="mb-3 flex items-center gap-2 text-[9px]">
          <span className="text-muted2">Base {positionSize.baseR}R</span>
          {positionSize.memoryEdgeMultiplier < 1 && (
            <span style={{ color: '#FBBF24' }}>× {positionSize.memoryEdgeMultiplier} mem</span>
          )}
          {positionSize.riskStateMultiplier < 1 && (
            <span style={{ color: '#F97316' }}>× {positionSize.riskStateMultiplier} state</span>
          )}
        </div>
      )}

      {/* Capital budget bars */}
      <div className="flex flex-col gap-2 mb-3">
        <RBar label="Daily Loss"   used={metrics.dailyLossR}   max={budget.maxDailyLossR}   color={dailyColor} />
        <RBar label="Weekly Loss"  used={metrics.weeklyLossR}  max={budget.maxWeeklyLossR}  color={weeklyColor} />
        <RBar label="Monthly Loss" used={metrics.monthlyLossR} max={budget.maxMonthlyLossR} color={monthlyColor} />
      </div>

      {/* Streak indicators */}
      {(metrics.consecutiveLosses > 0 || metrics.consecutiveWins > 0) && (
        <div
          className="mb-3 flex items-center justify-between px-2 py-1.5 rounded-badge text-[10px]"
          style={{ background: 'rgba(71,85,105,0.1)', border: '1px solid rgba(71,85,105,0.2)' }}
        >
          <span className="text-muted2">Streak</span>
          {metrics.consecutiveLosses > 0 && (
            <span style={{ color: '#FF3B5C' }}>
              {metrics.consecutiveLosses}× loss
              {metrics.consecutiveLosses >= budget.maxConsecutiveLosses - 1 && ' ⚠'}
            </span>
          )}
          {metrics.consecutiveWins > 0 && (
            <span style={{ color: '#00E5A8' }}>
              {metrics.consecutiveWins}× win
              {metrics.consecutiveWins >= budget.maxConsecutiveWins && ' ⚠'}
            </span>
          )}
          <span className="text-muted2 text-[9px]">
            limit {budget.maxConsecutiveLosses}L / {budget.maxConsecutiveWins}W
          </span>
        </div>
      )}

      {/* Active cooldown */}
      {cooldown.active && (
        <div
          className="mb-3 px-2 py-1.5 rounded-badge text-[10px]"
          style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}
        >
          <div className="flex justify-between mb-0.5">
            <span style={{ color: '#FBBF24' }}>Cooldown</span>
            <span className="font-bold tabular-nums" style={{ color: '#FBBF24' }}>
              {cooldown.remainingMinutes}m
            </span>
          </div>
          <div className="text-[9px] text-muted">{cooldown.reason}</div>
        </div>
      )}

      {/* Veto / block reasons */}
      {actionableVetos.length > 0 && (
        <div className="mb-2">
          <p className="text-[9px] text-muted2 uppercase tracking-wider mb-1">Blocks</p>
          <div className="flex flex-col gap-1">
            {actionableVetos.slice(0, 4).map((v) => <VetoRow key={v.code} veto={v} />)}
          </div>
        </div>
      )}

      {warnVetos.length > 0 && (
        <div className="mb-2">
          <div className="flex flex-col gap-1">
            {warnVetos.slice(0, 2).map((v) => <VetoRow key={v.code} veto={v} />)}
          </div>
        </div>
      )}

      {/* Approval chain (when approved/reduced) */}
      {decision !== 'BLOCKED' && approvalChain.length > 0 && (
        <div
          className="mt-2 pt-2 flex flex-col gap-0.5"
          style={{ borderTop: '1px solid rgba(71,85,105,0.2)' }}
        >
          {approvalChain.map((step, i) => (
            <span key={i} className="text-[9px] text-muted2">{step}</span>
          ))}
        </div>
      )}

      {/* Footer stats */}
      <div
        className="mt-3 pt-2 flex items-center gap-3 text-[9px]"
        style={{ borderTop: '1px solid rgba(71,85,105,0.2)' }}
      >
        <span className="text-muted2">Today</span>
        <span style={{ color: (metrics.dailyPnlR ?? 0) >= 0 ? '#00E5A8' : '#FF3B5C' }}>
          {(metrics.dailyPnlR ?? 0) >= 0 ? '+' : ''}{(metrics.dailyPnlR ?? 0).toFixed(1)}R
        </span>
        <span className="text-muted2">|</span>
        <span className="text-muted2">Trades</span>
        <span style={{ color: '#94A3B8' }}>{metrics.tradeCountToday ?? 0}</span>
        <span className="ml-auto" style={{ color: (metrics.weeklyPnlR ?? 0) >= 0 ? '#00E5A8' : '#FF3B5C' }}>
          W {(metrics.weeklyPnlR ?? 0) >= 0 ? '+' : ''}{(metrics.weeklyPnlR ?? 0).toFixed(1)}R
        </span>
      </div>
    </GlassCard>
  );
}
