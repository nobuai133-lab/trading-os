'use client';

import GlassCard         from '@/components/ui/GlassCard';
import { useMemoryFeed } from '@/hooks/useMemoryFeed';
import type { ExperienceLevel } from '@/types';

// ── Style helpers ─────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<ExperienceLevel, string> = {
  INSUFFICIENT: '#64748B',
  LOW:          '#FBBF24',
  MODERATE:     '#38BDF8',
  HIGH:         '#00E5A8',
};

const ACTION_COLORS = {
  PREFER:      '#00E5A8',
  AVOID:       '#FF3B5C',
  REDUCE_SIZE: '#FBBF24',
  WARN:        '#FBBF24',
} as const;

function SimilarityBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[10px] text-muted">{label}</span>
        <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
          {value}%
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(71,85,105,0.25)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MemoryIntelligenceCard() {
  const { summary, similarity, topLessons, fingerprint, loading, error } = useMemoryFeed();

  if (loading && !summary) {
    return (
      <GlassCard>
        <p className="card-title">Memory Intelligence</p>
        <p className="text-[11px] text-muted2 mt-2">Initializing…</p>
      </GlassCard>
    );
  }

  if (error && !summary) {
    return (
      <GlassCard>
        <p className="card-title">Memory Intelligence</p>
        <p className="text-[11px] text-danger mt-2">Unavailable — {error}</p>
      </GlassCard>
    );
  }

  const level     = summary?.experienceLevel ?? 'INSUFFICIENT';
  const levelCol  = LEVEL_COLORS[level];
  const winSim    = similarity?.winningSimilarity  ?? 0;
  const lossSim   = similarity?.losingSimilarity   ?? 0;
  const edge      = winSim - lossSim;
  const edgeCol   = edge > 15 ? '#00E5A8' : edge < -5 ? '#FF3B5C' : '#94A3B8';
  const calibConf = similarity?.calibratedDecisionConfidence;

  return (
    <GlassCard>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="card-title mb-0">Memory Intelligence</p>
        <span
          className="text-[9px] font-bold px-2 py-0.5 rounded-chip tracking-wider uppercase"
          style={{ color: levelCol, background: `${levelCol}18`, border: `1px solid ${levelCol}30` }}
        >
          {level} ({summary?.tradeCount ?? 0})
        </span>
      </div>

      {/* Similarity bars */}
      {similarity && (
        <div className="flex flex-col gap-2 mb-3">
          <SimilarityBar label="Win Similarity"  value={winSim}  color="#00E5A8" />
          <SimilarityBar label="Loss Similarity" value={lossSim} color="#FF3B5C" />

          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[10px] text-muted">Edge</span>
            <span className="text-[12px] font-black tabular-nums" style={{ color: edgeCol }}>
              {edge >= 0 ? '+' : ''}{edge}%
            </span>
          </div>
        </div>
      )}

      {/* Calibrated confidence */}
      {calibConf !== undefined && similarity && summary && summary.tradeCount >= 5 && (
        <div
          className="mb-3 px-2 py-1.5 rounded-badge text-[10px] flex justify-between"
          style={{ background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.15)' }}
        >
          <span style={{ color: '#94A3B8' }}>Calibrated Confidence</span>
          <span className="font-bold tabular-nums" style={{ color: '#38BDF8' }}>{calibConf}%</span>
        </div>
      )}

      {/* Nearest match */}
      {similarity?.nearestWinner && (
        <div className="mb-3">
          <p className="text-[9px] text-muted2 uppercase tracking-wider mb-1">Top Historical Match</p>
          <div
            className="px-2 py-1.5 rounded-badge"
            style={{ background: 'rgba(0,229,168,0.06)', border: '1px solid rgba(0,229,168,0.15)' }}
          >
            <div className="flex justify-between">
              <span className="text-[10px]" style={{ color: '#00E5A8' }}>
                {similarity.nearestWinner.record.direction} · {similarity.nearestWinner.record.grade} · {similarity.nearestWinner.record.outcome}
              </span>
              <span className="text-[10px] font-bold tabular-nums" style={{ color: '#00E5A8' }}>
                {similarity.nearestWinner.similarity}% match
              </span>
            </div>
            <div className="text-[9px] text-muted mt-0.5">
              {similarity.nearestWinner.record.resultR >= 0 ? '+' : ''}{similarity.nearestWinner.record.resultR}R
              · {similarity.nearestWinner.record.symbol}
            </div>
          </div>
        </div>
      )}

      {/* Active lessons */}
      {topLessons.length > 0 && (
        <div className="mb-2">
          <p className="text-[9px] text-muted2 uppercase tracking-wider mb-1">Active Lessons</p>
          <div className="flex flex-col gap-1.5">
            {topLessons.slice(0, 3).map((lesson) => {
              const col = ACTION_COLORS[lesson.action] ?? '#94A3B8';
              return (
                <div
                  key={lesson.id}
                  className="flex items-start gap-2 px-2 py-1.5 rounded-badge"
                  style={{ background: `${col}08`, border: `1px solid ${col}20` }}
                >
                  <span
                    className="text-[8px] font-bold shrink-0 mt-0.5 px-1 rounded"
                    style={{ color: col, background: `${col}20` }}
                  >
                    {lesson.action}
                  </span>
                  <span className="text-[10px] leading-snug" style={{ color: '#CBD5E1' }}>
                    {lesson.condition}
                  </span>
                  <span className="text-[9px] text-muted2 shrink-0 ml-auto">
                    {(lesson.winRate * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Similarity warnings */}
      {similarity && similarity.warnings.length > 0 && (
        <div>
          <p className="text-[9px] text-muted2 uppercase tracking-wider mb-1">Warnings</p>
          <div className="flex flex-col gap-1">
            {similarity.warnings.slice(0, 3).map((w, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-[10px]" style={{ color: '#FBBF24' }}>⚠</span>
                <span className="text-[10px] text-muted leading-snug">{w}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Store stats footer */}
      {summary && (
        <div
          className="mt-3 pt-2 flex items-center gap-3 text-[9px]"
          style={{ borderTop: '1px solid rgba(71,85,105,0.2)' }}
        >
          <span className="text-muted2">Store</span>
          <span style={{ color: '#00E5A8' }}>W {summary.winCount}</span>
          <span style={{ color: '#FF3B5C' }}>L {summary.lossCount}</span>
          <span style={{ color: '#94A3B8' }}>BE {summary.breakEvenCount}</span>
          <span className="ml-auto tabular-nums" style={{ color: summary.avgResultR >= 0 ? '#00E5A8' : '#FF3B5C' }}>
            avg {summary.avgResultR >= 0 ? '+' : ''}{summary.avgResultR}R
          </span>
        </div>
      )}
    </GlassCard>
  );
}
