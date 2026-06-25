'use client';

import GlassCard       from '@/components/ui/GlassCard';
import { useDecisionFeed } from '@/hooks/useDecisionFeed';
import type { DecisionOutcome } from '@/types';

// ── Outcome styles ────────────────────────────────────────────────────────────

interface OutcomeStyle { color: string; bg: string; border: string; label: string }

function outcomeStyle(outcome: DecisionOutcome): OutcomeStyle {
  switch (outcome) {
    case 'LONG':            return { color: '#00E5A8', bg: 'rgba(0,229,168,0.10)',   border: 'rgba(0,229,168,0.25)',   label: 'LONG' };
    case 'SHORT':           return { color: '#FF3B5C', bg: 'rgba(255,59,92,0.10)',   border: 'rgba(255,59,92,0.25)',   label: 'SHORT' };
    case 'HOLD':            return { color: '#38BDF8', bg: 'rgba(56,189,248,0.10)',  border: 'rgba(56,189,248,0.25)',  label: 'HOLD' };
    case 'REDUCE_POSITION': return { color: '#FBBF24', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.25)', label: 'REDUCE' };
    case 'READY':           return { color: '#A78BFA', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.25)', label: 'READY' };
    case 'NO_TRADE':        return { color: '#64748B', bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.25)', label: 'NO TRADE' };
    case 'EXIT':            return { color: '#FF3B5C', bg: 'rgba(255,59,92,0.10)',   border: 'rgba(255,59,92,0.25)',   label: 'EXIT' };
    case 'WAIT':
    default:                return { color: '#FBBF24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.20)', label: 'WAIT' };
  }
}

function confidenceColor(v: number): string {
  if (v >= 70) return '#00E5A8';
  if (v >= 45) return '#FBBF24';
  return '#FF3B5C';
}

// ── Gate summary strip ────────────────────────────────────────────────────────

function GateStrip({ gates }: { gates: Array<{ gate: string; passed: boolean }> }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {gates.map((g) => (
        <span
          key={g.gate}
          className="text-[8px] font-bold px-1.5 py-0.5 rounded-chip tabular-nums"
          style={{
            color:      g.passed ? '#00E5A8' : '#FF3B5C',
            background: g.passed ? 'rgba(0,229,168,0.08)' : 'rgba(255,59,92,0.08)',
            border:     `1px solid ${g.passed ? 'rgba(0,229,168,0.20)' : 'rgba(255,59,92,0.20)'}`,
          }}
        >
          {g.gate.split(':')[0]} {g.passed ? '✓' : '✗'}
        </span>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DecisionCard() {
  const { decision, loading, error } = useDecisionFeed();

  if (loading && !decision) {
    return (
      <GlassCard>
        <p className="card-title">Decision Intelligence</p>
        <p className="text-[11px] text-muted2 mt-2">Computing…</p>
      </GlassCard>
    );
  }

  if (error && !decision) {
    return (
      <GlassCard>
        <p className="card-title">Decision Intelligence</p>
        <p className="text-[11px] text-danger mt-2">Unavailable — {error}</p>
      </GlassCard>
    );
  }

  if (!decision) return null;

  const s    = outcomeStyle(decision.outcome);
  const conf = decision.confidence;
  const cCol = confidenceColor(conf);

  return (
    <GlassCard>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="card-title mb-0">Decision Intelligence</p>
        <span
          className="text-[11px] font-black px-2.5 py-1 rounded-badge tracking-wider"
          style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
        >
          {s.label}
        </span>
      </div>

      {/* Confidence bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted">Confidence</span>
          <span className="text-[12px] font-black tabular-nums" style={{ color: cCol }}>
            {conf}%
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(71,85,105,0.25)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${conf}%`, background: cCol }}
          />
        </div>
      </div>

      {/* Weighted score */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-muted">Weighted Score</span>
        <span className="text-[11px] font-semibold tabular-nums text-text">
          {decision.weightedScore} / {decision.maxScore}
        </span>
      </div>

      {/* Supporting */}
      {decision.topSupporting.length > 0 && (
        <div className="mb-2">
          <p className="text-[9px] text-muted2 uppercase tracking-wider mb-1">Supporting</p>
          <div className="flex flex-col gap-1">
            {decision.topSupporting.map((s_) => (
              <div key={s_} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#00E5A8' }} />
                <span className="text-[10px] text-text">{s_}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opposing */}
      {decision.topOpposing.length > 0 && (
        <div className="mb-2">
          <p className="text-[9px] text-muted2 uppercase tracking-wider mb-1">Opposing</p>
          <div className="flex flex-col gap-1">
            {decision.topOpposing.map((o) => (
              <div key={o} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#FF3B5C' }} />
                <span className="text-[10px] text-muted">{o}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocking reason */}
      {decision.blockingReason && (
        <div
          className="mb-2 px-2 py-1.5 rounded-badge text-[10px]"
          style={{ background: 'rgba(255,59,92,0.07)', border: '1px solid rgba(255,59,92,0.18)', color: '#FF3B5C' }}
        >
          {decision.blockingReason}
        </div>
      )}

      {/* Next action */}
      <div
        className="mb-3 px-2 py-1.5 rounded-badge text-[10px]"
        style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.12)', color: '#CBD5E1' }}
      >
        {decision.nextAction}
      </div>

      {/* Gate strip */}
      <GateStrip gates={decision.gates} />
    </GlassCard>
  );
}
