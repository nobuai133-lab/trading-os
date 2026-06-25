'use client';

import type { DashboardState } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import { fmt, fmtR } from '@/lib/utils';

interface Props {
  state: DashboardState;
}

export default function PostTradeReview({ state }: Props) {
  const { trade, memory, symbol } = state;

  const isClosed = trade.status === 'CLOSED_WIN' || trade.status === 'CLOSED_LOSS' || trade.status === 'CLOSED_MANUAL';
  const isWin    = trade.status === 'CLOSED_WIN';
  const isLoss   = trade.status === 'CLOSED_LOSS';
  const isActive = trade.status === 'ACTIVE' || trade.status === 'TP1_HIT' || trade.status === 'TP2_HIT' || trade.status === 'ENTERED';
  const isIdle   = trade.status === 'IDLE' || trade.status === 'WAITING' || trade.status === 'READY';

  /* ─── ACTIVE TRADE STATE ─── */
  if (isActive) {
    return (
      <div className="flex flex-col gap-3">
        <GlassCard
          padding="p-4"
          style={{
            background: 'rgba(56,189,248,0.06)',
            border:     '1px solid rgba(56,189,248,0.15)',
          } as React.CSSProperties}
        >
          <p className="card-title">Running P&L</p>
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted">Unrealized</span>
              <span
                className="text-[36px] font-black leading-none tabular-nums"
                style={{ color: trade.unrealizedR >= 0 ? '#00E5A8' : '#FF3B5C' }}
              >
                {trade.unrealizedR ? fmtR(trade.unrealizedR) : '—'}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-muted">Open Position</span>
              <span className="text-[20px] font-bold text-text">{trade.openPct}%</span>
            </div>
          </div>

          <div
            className="mt-3 h-1 rounded-full overflow-hidden"
            style={{ background: 'rgba(71,85,105,0.25)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width:      `${trade.openPct}%`,
                background: '#38BDF8',
              }}
            />
          </div>
        </GlassCard>

        <GlassCard>
          <p className="card-title">Review Status</p>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] text-muted2">
              Auto-review generates on trade close. Stay disciplined — follow your plan.
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: '#FBBF24',
                animation:  'blink 1.4s ease-in-out infinite',
              }}
            />
            <span className="text-[10px] font-semibold text-amber">
              REVIEW PENDING TRADE CLOSE
            </span>
          </div>
        </GlassCard>
      </div>
    );
  }

  /* ─── CLOSED TRADE STATE ─── */
  if (isClosed) {
    const resultColor = isWin ? '#00E5A8' : '#FF3B5C';
    const bannerBg    = isWin ? 'rgba(0,229,168,0.08)' : 'rgba(255,59,92,0.08)';
    const bannerBorder= isWin ? 'rgba(0,229,168,0.20)' : 'rgba(255,59,92,0.20)';
    const bannerText  = isWin
      ? 'TRADE COMPLETED · DO NOT CHASE · WAIT FOR NEW SETUP'
      : 'TRADE CLOSED · REVIEW YOUR PLAN · NO REVENGE TRADE';

    const reviewRows = [
      { label: 'Symbol',      value: symbol },
      { label: 'Direction',   value: trade.direction },
      { label: 'Entry',       value: fmt(trade.entry) },
      { label: 'Result',      value: memory.result,       color: resultColor },
      { label: 'Exit Reason', value: isWin ? 'TP3 reached' : 'SL hit' },
      { label: 'Grade',       value: trade.grade,         color: resultColor },
    ];

    return (
      <div className="flex flex-col gap-3">
        {/* Completion banner */}
        <GlassCard
          padding="p-4"
          style={{
            background: bannerBg,
            border:     `1px solid ${bannerBorder}`,
          } as React.CSSProperties}
        >
          <div className="text-center">
            <div
              className="text-[32px] font-black tabular-nums mb-1"
              style={{ color: resultColor }}
            >
              {memory.result}
            </div>
            <p
              className="text-[9px] font-bold tracking-widest uppercase"
              style={{ color: resultColor }}
            >
              {bannerText}
            </p>
          </div>
        </GlassCard>

        {/* Review rows */}
        <GlassCard>
          <p className="card-title">Trade Review</p>
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {reviewRows.map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                <span className="text-[10px] text-muted">{label}</span>
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: color ?? '#F8FAFC' }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Lessons */}
        <GlassCard>
          <p className="card-title">Post-Trade Lessons</p>
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green shrink-0" />
              <span className="text-[9px] font-bold tracking-widest uppercase text-green">
                Key Lesson
              </span>
            </div>
            <p className="text-[11px] text-muted leading-relaxed pl-3">
              {memory.lesson}
            </p>
          </div>
          <div className="h-px bg-white/[0.05] mb-3" />
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red shrink-0" />
              <span className="text-[9px] font-bold tracking-widest uppercase text-red">
                Mistake
              </span>
            </div>
            <p className="text-[11px] text-muted leading-relaxed pl-3">
              {memory.mistake}
            </p>
          </div>
        </GlassCard>

        {/* Next step */}
        <GlassCard
          padding="p-3"
          style={{
            background: 'rgba(56,189,248,0.06)',
            border:     '1px solid rgba(56,189,248,0.15)',
          } as React.CSSProperties}
        >
          <div className="flex items-center gap-2">
            <span className="text-[14px]">→</span>
            <span className="text-[11px] font-semibold text-blue">
              NEXT: WAIT FOR NEW SETUP · RESET BIAS · SCAN NEXT SESSION
            </span>
          </div>
        </GlassCard>
      </div>
    );
  }

  /* ─── IDLE / NO ACTIVE TRADE ─── */
  return (
    <div className="flex flex-col gap-3">
      <GlassCard
        padding="p-8"
        style={{
          background: 'rgba(100,116,139,0.05)',
          border:     '1px solid rgba(100,116,139,0.12)',
        } as React.CSSProperties}
      >
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <span className="text-[28px] opacity-30">◎</span>
          <p className="text-[11px] font-semibold tracking-widest uppercase text-muted2">
            No Active Trade
          </p>
          <p className="text-[10px] text-muted2">
            Review auto-generates on trade close
          </p>
        </div>
      </GlassCard>

      <GlassCard>
        <p className="card-title">Previous Review</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted">Trade ID</span>
            <span className="text-[11px] font-mono text-muted2">{memory.tradeId}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted">Result</span>
            <span
              className="text-[14px] font-black"
              style={{ color: memory.result.startsWith('+') ? '#00E5A8' : '#FF3B5C' }}
            >
              {memory.result}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted">Bias Reset</span>
            <span
              className="text-[11px] font-semibold"
              style={{ color: memory.biasCarryover ? '#FBBF24' : '#64748B' }}
            >
              {memory.biasCarryover ? 'Carryover Active' : 'Complete'}
            </span>
          </div>
        </div>
        <div className="mt-3 h-px bg-white/[0.05]" />
        <p className="text-[10px] text-muted2 mt-3 leading-snug">{memory.lesson}</p>
      </GlassCard>
    </div>
  );
}
