'use client';

import type { RangeMemory, RangeStatus } from '@/types';
import GlassCard from '@/components/ui/GlassCard';

const RANGE_STATUS_STYLE: Record<RangeStatus, { color: string; bg: string; border: string }> = {
  NEW:    { color: '#38BDF8', bg: 'rgba(56,189,248,0.10)',  border: 'rgba(56,189,248,0.25)' },
  ACTIVE: { color: '#00E5A8', bg: 'rgba(0,229,168,0.10)',   border: 'rgba(0,229,168,0.25)'  },
  TRADED: { color: '#FBBF24', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.25)' },
  STALE:  { color: '#64748B', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.20)' },
  RESET:  { color: '#A78BFA', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.25)' },
};

interface Props {
  rangeMemory: RangeMemory;
}

function YesNo({ value }: { value: boolean }) {
  return (
    <span
      className="text-[10px] font-bold"
      style={{ color: value ? '#00E5A8' : '#FF3B5C' }}
    >
      {value ? 'YES' : 'NO'}
    </span>
  );
}

export default function RangeStatusCard({ rangeMemory }: Props) {
  const ss = RANGE_STATUS_STYLE[rangeMemory.status];

  return (
    <GlassCard padding="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="card-title mb-0">Range Memory</p>
        <span
          className="text-[8px] font-bold px-1.5 py-0.5 rounded-chip tracking-widest"
          style={{ color: ss.color, background: ss.bg, border: `1px solid ${ss.border}` }}
        >
          {rangeMemory.status}
        </span>
      </div>

      {/* Range ID */}
      <p
        className="text-[9px] font-mono mb-2 truncate"
        style={{ color: '#475569' }}
        title={rangeMemory.rangeId}
      >
        {rangeMemory.rangeId}
      </p>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-muted2">Range High</span>
          <span className="text-[10px] font-semibold text-text tabular-nums">
            ${rangeMemory.rangeHigh.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-muted2">Range Low</span>
          <span className="text-[10px] font-semibold text-text tabular-nums">
            ${rangeMemory.rangeLow.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-muted2">Trade Count</span>
          <span className="text-[10px] font-bold" style={{ color: rangeMemory.tradeCount > 0 ? '#FBBF24' : '#64748B' }}>
            {rangeMemory.tradeCount}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-muted2">Last Dir</span>
          <span
            className="text-[10px] font-bold"
            style={{ color: rangeMemory.lastTradeDirection === 'SHORT' ? '#FF3B5C' : rangeMemory.lastTradeDirection === 'LONG' ? '#00E5A8' : '#64748B' }}
          >
            {rangeMemory.lastTradeDirection ?? '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-muted2">Fresh Liq</span>
          <YesNo value={rangeMemory.freshLiquidity} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-muted2">Reentry</span>
          <YesNo value={rangeMemory.reentryAllowed} />
        </div>
      </div>

      {/* Last result */}
      {rangeMemory.lastTradeResult && (
        <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted2">Last Result</span>
            <span className="text-[10px] font-bold" style={{ color: '#00E5A8' }}>
              {rangeMemory.lastTradeResult}
            </span>
          </div>
        </div>
      )}

      {/* Stale warning */}
      {rangeMemory.status === 'STALE' && (
        <div
          className="mt-2 rounded-[6px] px-2 py-1.5 text-center"
          style={{ background: 'rgba(100,116,139,0.12)', border: '1px solid rgba(100,116,139,0.20)' }}
        >
          <p className="text-[9px] font-semibold" style={{ color: '#64748B' }}>
            Stale range. Waiting for new liquidity or structure reset.
          </p>
        </div>
      )}
    </GlassCard>
  );
}
