'use client';

import type { DashboardState, TradeStatus, SLStatus } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import TPProgressBar from '@/components/ui/TPProgressBar';
import LifecycleStepper from '@/components/ui/LifecycleStepper';
import { fmt, fmtR } from '@/lib/utils';

const STATUS_BADGE: Record<string, { text: string; color: string }> = {
  ENTRY:      { text: 'ENTRY',     color: '#38BDF8' },
  BREAKEVEN:  { text: 'BEVEN',     color: '#FBBF24' },
  TRAILING:   { text: 'TRAIL',     color: '#A78BFA' },
  HIT:        { text: 'HIT',       color: '#00E5A8' },
  CLOSED:     { text: 'CLOSED',    color: '#64748B' },
  INITIAL:    { text: 'INITIAL',   color: '#64748B' },
  'N/A':      { text: 'N/A',       color: '#475569' },
};

const TRADE_STATUS_COLORS: Record<TradeStatus, string> = {
  IDLE:         '#64748B',
  WAITING:      '#38BDF8',
  READY:        '#FBBF24',
  ENTERED:      '#A78BFA',
  ACTIVE:       '#00E5A8',
  TP1_HIT:      '#00E5A8',
  TP2_HIT:      '#00E5A8',
  TP3_HIT:      '#00E5A8',
  CLOSED_WIN:   '#00E5A8',
  CLOSED_LOSS:  '#FF3B5C',
  CLOSED_MANUAL:'#FBBF24',
  EXPIRED:      '#FF3B5C',
  INVALIDATED:  '#FF3B5C',
};

const GRADE_COLORS: Record<string, string> = {
  'A+': '#00E5A8',
  'A':  '#00E5A8',
  'B':  '#FBBF24',
  'C':  '#FF3B5C',
  '—':  '#64748B',
};

interface Props {
  state: DashboardState;
}

export default function TradeSetupCard({ state }: Props) {
  const { trade, symbol, timeframe } = state;

  const hasZone     = !!trade.entryZone && trade.slStatus === 'INITIAL';
  const inZoneNow   = hasZone && state.price >= trade.entryZone!.low && state.price <= trade.entryZone!.high;

  const levels = [
    {
      label:     hasZone ? 'ZONE' : 'ENTRY',
      value:     trade.entry,
      rangeHigh: hasZone ? trade.entryZone!.high : undefined,
      rangeLow:  hasZone ? trade.entryZone!.low  : undefined,
      badge:     inZoneNow ? { text: 'IN ZONE', color: '#FBBF24' } : trade.entry > 0 && !hasZone ? { text: 'FILLED', color: '#38BDF8' } : null,
      hit:       !hasZone && trade.entry > 0,
      isZone:    hasZone,
    },
    { label: 'SL',    value: trade.slCurrent, badge: STATUS_BADGE[trade.slStatus], hit: false, isSL: true },
    { label: 'TP1',   value: trade.tp1,       badge: trade.tp1Hit ? { text: 'HIT', color: '#00E5A8' } : null, hit: trade.tp1Hit },
    { label: 'TP2',   value: trade.tp2,       badge: trade.tp2Hit ? { text: 'HIT', color: '#00E5A8' } : null, hit: trade.tp2Hit },
    { label: 'TP3',   value: trade.tp3,       badge: trade.tp3Hit ? { text: 'HIT', color: '#00E5A8' } : null, hit: trade.tp3Hit },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <GlassCard padding="p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {/* Direction pill */}
            {trade.direction !== '—' && (
              <span
                className="text-[11px] font-bold px-2.5 py-1 rounded-chip"
                style={{
                  color:      trade.direction === 'SHORT' ? '#FF3B5C' : '#00E5A8',
                  background: trade.direction === 'SHORT' ? 'rgba(255,59,92,0.12)' : 'rgba(0,229,168,0.12)',
                  border:     `1px solid ${trade.direction === 'SHORT' ? 'rgba(255,59,92,0.25)' : 'rgba(0,229,168,0.25)'}`,
                }}
              >
                {trade.direction}
              </span>
            )}
            {/* Grade */}
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-badge"
              style={{
                color:      GRADE_COLORS[trade.grade],
                background: `${GRADE_COLORS[trade.grade]}14`,
                border:     `1px solid ${GRADE_COLORS[trade.grade]}30`,
              }}
            >
              {trade.grade}
            </span>
            {/* Symbol · TF */}
            <span className="text-[11px] font-semibold text-muted">
              {symbol} · {timeframe}
            </span>
          </div>

          {/* Status + expiry */}
          <div className="flex items-center gap-2">
            <span
              className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-chip"
              style={{
                color:      TRADE_STATUS_COLORS[trade.status],
                background: `${TRADE_STATUS_COLORS[trade.status]}14`,
                border:     `1px solid ${TRADE_STATUS_COLORS[trade.status]}28`,
              }}
            >
              {trade.status.replace('_', ' ')}
            </span>
            {trade.expiryBars > 0 && (
              <span className="text-[10px] text-muted2">
                {trade.expiryBars}b left
              </span>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Levels */}
      <GlassCard>
        <p className="card-title">Levels</p>
        <div className="flex flex-col divide-y divide-white/[0.04]">
          {levels.map(({ label, value, badge, hit, isSL, isZone, rangeLow, rangeHigh }) => (
            <div key={label} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
              <span
                className="text-[10px] font-bold tracking-widest uppercase w-10 shrink-0"
                style={{ color: isSL ? '#FF3B5C' : isZone ? '#FBBF24' : '#64748B' }}
              >
                {label}
              </span>
              {isZone && rangeLow !== undefined && rangeHigh !== undefined ? (
                <span className="text-[12px] font-semibold tabular-nums flex-1 text-right" style={{ color: '#FBBF24' }}>
                  ${rangeLow.toLocaleString()} – ${rangeHigh.toLocaleString()}
                </span>
              ) : (
                <span
                  className="text-[13px] font-semibold tabular-nums flex-1 text-right"
                  style={{ color: hit ? '#00E5A8' : '#F8FAFC' }}
                >
                  {fmt(value)}
                </span>
              )}
              {badge && (
                <span
                  className="ml-2 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-sm shrink-0"
                  style={{
                    color:      badge.color,
                    background: `${badge.color}16`,
                    border:     `1px solid ${badge.color}30`,
                  }}
                >
                  {badge.text}
                </span>
              )}
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Risk Parameters */}
      <GlassCard>
        <p className="card-title">Risk Parameters</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Risk %',    value: trade.riskPct ? `${trade.riskPct}%` : '—',           color: '#F8FAFC' },
            { label: 'R:R',       value: trade.rr ? `${trade.rr.toFixed(1)}R` : '—',          color: '#38BDF8' },
            { label: 'Size BTC',  value: trade.sizeBtc ? `${trade.sizeBtc}` : '—',            color: '#A78BFA' },
            { label: 'Unreal R',  value: trade.unrealizedR ? fmtR(trade.unrealizedR) : '—',   color: trade.unrealizedR >= 0 ? '#00E5A8' : '#FF3B5C' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="card-label">{label}</span>
              <span className="text-[16px] font-bold tabular-nums" style={{ color }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Progress */}
      <GlassCard>
        <p className="card-title">Progress</p>
        <TPProgressBar trade={trade} currentPrice={state.price} />
      </GlassCard>

      {/* Lifecycle */}
      <GlassCard>
        <p className="card-title">Lifecycle</p>
        <LifecycleStepper currentIndex={state.lifecycleIndex} />
      </GlassCard>
    </div>
  );
}
