'use client';

import type { DashboardState, TradeStatus } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import TPProgressBar from '@/components/ui/TPProgressBar';
import LifecycleStepper from '@/components/ui/LifecycleStepper';
import { fmt, fmtR } from '@/lib/utils';

const TRADE_STATUS_COLORS: Record<TradeStatus, string> = {
  IDLE:          '#64748B',
  WAITING:       '#38BDF8',
  READY:         '#FBBF24',
  ENTERED:       '#A78BFA',
  ACTIVE:        '#00E5A8',
  TP1_HIT:       '#00E5A8',
  TP2_HIT:       '#00E5A8',
  TP3_HIT:       '#00E5A8',
  CLOSED_WIN:    '#00E5A8',
  CLOSED_LOSS:   '#FF3B5C',
  CLOSED_MANUAL: '#FBBF24',
  EXPIRED:       '#FF3B5C',
  INVALIDATED:   '#FF3B5C',
};

const SL_STATUS_BADGE: Record<string, { text: string; color: string }> = {
  INITIAL:   { text: 'INITIAL',  color: '#64748B' },
  BREAKEVEN: { text: 'BREAKEVEN', color: '#FBBF24' },
  TRAILING:  { text: 'TRAILING', color: '#A78BFA' },
  HIT:       { text: 'HIT',      color: '#FF3B5C' },
  CLOSED:    { text: 'CLOSED',   color: '#64748B' },
  'N/A':     { text: 'N/A',      color: '#475569' },
};

interface Props {
  state: DashboardState;
}

export default function ActiveTradePanel({ state }: Props) {
  const { trade, memory, pendingSetups } = state;

  const isIdle    = trade.status === 'IDLE' || trade.status === 'WAITING' || trade.status === 'READY';
  const isClosed  = trade.status === 'CLOSED_WIN' || trade.status === 'CLOSED_LOSS' || trade.status === 'CLOSED_MANUAL';
  const isWin     = trade.status === 'CLOSED_WIN';
  const isActive  = !isIdle && !isClosed;
  const dirColor  = trade.direction === 'SHORT' ? '#FF3B5C' : trade.direction === 'LONG' ? '#00E5A8' : '#64748B';
  const hasZone   = !!trade.entryZone && trade.slStatus === 'INITIAL';
  const inZone    = hasZone && state.price >= trade.entryZone!.low && state.price <= trade.entryZone!.high;

  /* ─── WAITING FOR ENTRY ─── */
  if (isIdle) {
    const nextSetup = pendingSetups?.find(s => s.status !== 'INVALIDATED');
    return (
      <div className="flex flex-col gap-3">
        <GlassCard
          padding="p-5"
          style={{
            background: 'rgba(56,189,248,0.05)',
            border:     '1px solid rgba(56,189,248,0.12)',
          } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: '#38BDF8', boxShadow: '0 0 6px rgba(56,189,248,0.6)', animation: 'blink 1.4s ease-in-out infinite' }}
              />
              <span className="text-[10px] font-bold tracking-widest uppercase text-blue">
                Scanning — No Active Trade
              </span>
            </div>
            {nextSetup ? (
              <>
                <p className="text-[13px] font-semibold text-text mt-1">
                  Watching{' '}
                  <span style={{ color: '#FBBF24' }}>{nextSetup.label}</span>
                  {' '}entry zone
                </p>
                <p className="text-[12px] font-bold tabular-nums" style={{ color: '#FBBF24' }}>
                  ${nextSetup.entryZone.low.toLocaleString()} – ${nextSetup.entryZone.high.toLocaleString()}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-muted">Current price</span>
                  <span className="text-[12px] font-bold tabular-nums text-text">
                    ${state.price.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-muted">
                    {state.price > nextSetup.entryZone.high
                      ? `↓ $${(state.price - nextSetup.entryZone.high).toLocaleString()} to zone`
                      : state.price < nextSetup.entryZone.low
                      ? `↑ $${(nextSetup.entryZone.low - state.price).toLocaleString()} to zone`
                      : '✓ IN ZONE'}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-muted2 mt-1">
                No setup qualified yet. Wait for structure to develop.
              </p>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <p className="card-title">Previous Trade</p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-muted2">{memory.tradeId}</span>
            <span
              className="text-[18px] font-black tabular-nums"
              style={{ color: memory.result.startsWith('+') ? '#00E5A8' : '#FF3B5C' }}
            >
              {memory.result}
            </span>
          </div>
          <p className="text-[10px] text-muted2 leading-snug">{memory.lesson}</p>
        </GlassCard>

        <GlassCard>
          <p className="card-title">Lifecycle</p>
          <LifecycleStepper currentIndex={state.lifecycleIndex} />
        </GlassCard>
      </div>
    );
  }

  /* ─── CLOSED TRADE ─── */
  if (isClosed) {
    const resultColor = isWin ? '#00E5A8' : '#FF3B5C';
    const bannerText  = isWin
      ? 'COMPLETE · DO NOT CHASE · WAIT FOR NEW SETUP'
      : 'CLOSED · REVIEW YOUR PLAN · NO REVENGE TRADE';

    return (
      <div className="flex flex-col gap-3">
        <GlassCard
          padding="p-4"
          style={{
            background: isWin ? 'rgba(0,229,168,0.08)' : 'rgba(255,59,92,0.08)',
            border:     `1px solid ${isWin ? 'rgba(0,229,168,0.20)' : 'rgba(255,59,92,0.20)'}`,
          } as React.CSSProperties}
        >
          <div className="text-center">
            <div className="text-[32px] font-black tabular-nums mb-1" style={{ color: resultColor }}>
              {memory.result}
            </div>
            <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: resultColor }}>
              {bannerText}
            </p>
          </div>
        </GlassCard>

        <GlassCard>
          <p className="card-title">Trade Review</p>
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {[
              { label: 'Direction', value: trade.direction, color: dirColor },
              { label: 'Entry',     value: fmt(trade.entry) },
              { label: 'Result',    value: memory.result, color: resultColor },
              { label: 'Grade',     value: trade.grade, color: resultColor },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                <span className="text-[10px] text-muted">{label}</span>
                <span className="text-[12px] font-semibold" style={{ color: color ?? '#F8FAFC' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green shrink-0" />
            <span className="text-[9px] font-bold tracking-widest uppercase text-green">Lesson</span>
          </div>
          <p className="text-[11px] text-muted leading-relaxed">{memory.lesson}</p>
          <div className="h-px bg-white/[0.05] my-2" />
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red shrink-0" />
            <span className="text-[9px] font-bold tracking-widest uppercase text-red">Mistake</span>
          </div>
          <p className="text-[11px] text-muted leading-relaxed">{memory.mistake}</p>
        </GlassCard>

        <GlassCard padding="p-3" style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)' } as React.CSSProperties}>
          <span className="text-[11px] font-semibold text-blue">
            → NEXT: RESET BIAS · SCAN FOR NEW SETUP
          </span>
        </GlassCard>
      </div>
    );
  }

  /* ─── ACTIVE TRADE ─── */
  const slBadge = SL_STATUS_BADGE[trade.slStatus];

  const levels = [
    {
      label:    hasZone ? 'ZONE' : 'ENTRY',
      value:    trade.entry,
      rangeLow: hasZone ? trade.entryZone!.low  : undefined,
      rangeHigh:hasZone ? trade.entryZone!.high : undefined,
      badge:    inZone ? { text: 'IN ZONE', color: '#FBBF24' }
              : !hasZone && trade.entry > 0 ? { text: 'FILLED', color: '#38BDF8' }
              : null,
      color:    hasZone ? '#FBBF24' : '#F8FAFC',
      isZone:   hasZone,
    },
    {
      label: 'SL',
      value: trade.slCurrent,
      badge: slBadge,
      color: '#FF3B5C',
    },
    {
      label: 'TP1',
      value: trade.tp1,
      badge: trade.tp1Hit ? { text: 'HIT', color: '#00E5A8' } : null,
      color: trade.tp1Hit ? '#00E5A8' : '#F8FAFC',
    },
    {
      label: 'TP2',
      value: trade.tp2,
      badge: trade.tp2Hit ? { text: 'HIT', color: '#00E5A8' } : null,
      color: trade.tp2Hit ? '#00E5A8' : '#F8FAFC',
    },
    {
      label: 'TP3',
      value: trade.tp3,
      badge: trade.tp3Hit ? { text: 'HIT', color: '#00E5A8' } : null,
      color: trade.tp3Hit ? '#00E5A8' : '#F8FAFC',
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <GlassCard padding="p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {trade.direction !== '—' && (
              <span
                className="text-[13px] font-black px-3 py-1 rounded-chip"
                style={{ color: dirColor, background: `${dirColor}14`, border: `1px solid ${dirColor}28` }}
              >
                {trade.direction}
              </span>
            )}
            <span className="text-[11px] font-bold" style={{ color: '#A78BFA' }}>{trade.grade}</span>
            <span className="text-[10px] text-muted">{state.symbol} · {state.timeframe}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-chip"
              style={{
                color:      TRADE_STATUS_COLORS[trade.status],
                background: `${TRADE_STATUS_COLORS[trade.status]}14`,
                border:     `1px solid ${TRADE_STATUS_COLORS[trade.status]}28`,
              }}
            >
              {trade.status.replace(/_/g, ' ')}
            </span>
            {trade.expiryBars > 0 && (
              <span className="text-[10px] text-muted2">{trade.expiryBars}b left</span>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Running P&L */}
      {trade.unrealizedR !== 0 && (
        <GlassCard padding="p-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="card-label">Running P&L</span>
              <span
                className="text-[28px] font-black tabular-nums leading-none"
                style={{ color: trade.unrealizedR >= 0 ? '#00E5A8' : '#FF3B5C' }}
              >
                {fmtR(trade.unrealizedR)}
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="card-label">Open</span>
              <span className="text-[20px] font-bold text-text">{trade.openPct}%</span>
            </div>
          </div>
          <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(71,85,105,0.25)' }}>
            <div className="h-full rounded-full" style={{ width: `${trade.openPct}%`, background: '#38BDF8' }} />
          </div>
        </GlassCard>
      )}

      {/* Levels */}
      <GlassCard>
        <p className="card-title">Levels</p>
        <div className="flex flex-col divide-y divide-white/[0.04]">
          {levels.map(({ label, value, badge, color, isZone, rangeLow, rangeHigh }) => (
            <div key={label} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
              <span
                className="text-[10px] font-bold tracking-widest uppercase w-10 shrink-0"
                style={{ color: label === 'SL' ? '#FF3B5C' : isZone ? '#FBBF24' : '#64748B' }}
              >
                {label}
              </span>
              {isZone && rangeLow !== undefined && rangeHigh !== undefined ? (
                <span className="text-[12px] font-semibold tabular-nums flex-1 text-right" style={{ color: '#FBBF24' }}>
                  ${rangeLow.toLocaleString()} – ${rangeHigh.toLocaleString()}
                </span>
              ) : (
                <span className="text-[13px] font-semibold tabular-nums flex-1 text-right" style={{ color }}>
                  {fmt(value)}
                </span>
              )}
              {badge && (
                <span
                  className="ml-2 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-sm shrink-0"
                  style={{ color: badge.color, background: `${badge.color}16`, border: `1px solid ${badge.color}30` }}
                >
                  {badge.text}
                </span>
              )}
            </div>
          ))}
        </div>
      </GlassCard>

      {/* TP Progress */}
      <GlassCard>
        <p className="card-title">Progress</p>
        <TPProgressBar trade={trade} currentPrice={state.price} />
      </GlassCard>

      {/* Lifecycle */}
      <GlassCard>
        <p className="card-title">Lifecycle</p>
        <LifecycleStepper currentIndex={state.lifecycleIndex} />
      </GlassCard>

      {/* Partials tracker */}
      <GlassCard padding="p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted">Partials taken</span>
          <div className="flex items-center gap-1.5">
            {[
              { label: 'TP1', hit: trade.tp1Hit, pct: '50%' },
              { label: 'TP2', hit: trade.tp2Hit, pct: '25%' },
              { label: 'TP3', hit: trade.tp3Hit, pct: '25%' },
            ].map(({ label, hit, pct }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-badge"
                style={{
                  background: hit ? 'rgba(0,229,168,0.12)' : 'rgba(71,85,105,0.15)',
                  border:     `1px solid ${hit ? 'rgba(0,229,168,0.28)' : 'rgba(71,85,105,0.28)'}`,
                }}
              >
                <span className="text-[8px] font-bold" style={{ color: hit ? '#00E5A8' : '#475569' }}>{label}</span>
                <span className="text-[8px] text-muted2">{pct}</span>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
