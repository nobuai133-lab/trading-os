'use client';

import type { DashboardState, AssumptionStatus } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import InvalidationMatrix from '@/components/ui/InvalidationMatrix';
import DecayTrail from '@/components/ui/DecayTrail';
import { fmtR } from '@/lib/utils';

const ASSUMPTION_COLORS: Record<AssumptionStatus, { dot: string; text: string; badge: string }> = {
  ACTIVE:   { dot: '#00E5A8', text: '#F8FAFC', badge: 'rgba(0,229,168,0.10)'  },
  WEAKENED: { dot: '#FBBF24', text: '#94A3B8', badge: 'rgba(251,191,36,0.10)' },
  FAILED:   { dot: '#FF3B5C', text: '#475569', badge: 'rgba(255,59,92,0.08)'  },
};

const SL_STATUS_COLORS: Record<string, string> = {
  INITIAL:   '#64748B',
  BREAKEVEN: '#FBBF24',
  TRAILING:  '#A78BFA',
  HIT:       '#FF3B5C',
  CLOSED:    '#64748B',
  'N/A':     '#475569',
};

interface Props {
  state: DashboardState;
}

export default function RiskPanel({ state }: Props) {
  const { trade, thesis } = state;

  const assumptions   = thesis?.assumptions ?? [];
  const activeCount   = assumptions.filter((a) => a.status === 'ACTIVE').length;
  const weakenedCount = assumptions.filter((a) => a.status === 'WEAKENED').length;
  const failedCount   = assumptions.filter((a) => a.status === 'FAILED').length;

  const thesisColor = thesis.score >= 80 ? '#00E5A8' : thesis.score >= 60 ? '#FBBF24' : '#FF3B5C';

  return (
    <div className="flex flex-col gap-3">
      {/* Invalidation */}
      <GlassCard>
        <p className="card-title">Invalidation Layers</p>
        <InvalidationMatrix layers={state.invalidation} />
      </GlassCard>

      {/* Confidence Decay */}
      <GlassCard>
        <p className="card-title">Confidence Decay</p>
        <DecayTrail events={state.decayEvents} />
      </GlassCard>

      {/* Position Manager */}
      <GlassCard>
        <p className="card-title">Position Manager</p>
        <div className="flex flex-col gap-2">
          {/* SL Status */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted">SL Status</span>
            <span
              className="text-[11px] font-semibold"
              style={{ color: SL_STATUS_COLORS[trade.slStatus] }}
            >
              {trade.slStatus}
            </span>
          </div>

          {/* SL Current */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted">SL Price</span>
            <span className="text-[11px] font-semibold tabular-nums text-text">
              ${trade.slCurrent ? trade.slCurrent.toLocaleString() : '—'}
            </span>
          </div>

          {/* Open % */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted">Position Open</span>
            <div className="flex items-center gap-2">
              <div
                className="h-1.5 w-20 rounded-full overflow-hidden"
                style={{ background: 'rgba(71,85,105,0.3)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width:      `${trade.openPct}%`,
                    background: trade.openPct > 0 ? '#38BDF8' : '#475569',
                  }}
                />
              </div>
              <span className="text-[11px] font-semibold text-text">{trade.openPct}%</span>
            </div>
          </div>

          {/* Partial closes */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted">Partials Taken</span>
            <div className="flex items-center gap-1">
              {[trade.tp1Hit, trade.tp2Hit, trade.tp3Hit].map((hit, i) => (
                <span
                  key={i}
                  className="w-4 h-4 rounded-sm text-[8px] font-bold flex items-center justify-center"
                  style={{
                    background: hit ? 'rgba(0,229,168,0.15)' : 'rgba(71,85,105,0.2)',
                    color:      hit ? '#00E5A8' : '#475569',
                    border:     `1px solid ${hit ? 'rgba(0,229,168,0.3)' : 'rgba(71,85,105,0.3)'}`,
                  }}
                >
                  T{i + 1}
                </span>
              ))}
            </div>
          </div>

          {/* Unrealized R */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted">Unrealized R</span>
            <span
              className="text-[14px] font-black tabular-nums"
              style={{ color: trade.unrealizedR >= 0 ? '#00E5A8' : '#FF3B5C' }}
            >
              {trade.unrealizedR ? fmtR(trade.unrealizedR) : '—'}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Thesis */}
      <GlassCard>
        <div className="flex items-center justify-between mb-3">
          <p className="card-title mb-0">Thesis</p>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-muted2">{activeCount}A · {weakenedCount}W · {failedCount}F</span>
            <span
              className="text-[14px] font-black tabular-nums"
              style={{ color: thesisColor }}
            >
              {thesis.score}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          {assumptions.map((a) => {
            const s = ASSUMPTION_COLORS[a.status];
            return (
              <div
                key={a.id}
                className="flex items-start gap-2 rounded-badge px-2 py-1.5"
                style={{ background: s.badge, border: `1px solid ${s.dot}18` }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full mt-[4px] shrink-0"
                  style={{ background: s.dot }}
                />
                <span className="text-[10px] leading-snug flex-1" style={{ color: s.text }}>
                  {a.label}
                </span>
                <span
                  className="text-[8px] font-bold tracking-wider shrink-0"
                  style={{ color: s.dot }}
                >
                  {a.status}
                </span>
              </div>
            );
          })}
        </div>

        {/* Thesis score bar */}
        <div className="mt-3">
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: 'rgba(71,85,105,0.25)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width:      `${thesis.score}%`,
                background: thesisColor,
              }}
            />
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
