'use client';

import GlassCard                   from '@/components/ui/GlassCard';
import { usePaperPositionsFeed }   from '@/hooks/usePaperPositionsFeed';
import type { PaperPosition, PaperPositionStatus } from '@/types';

// ── Style helpers ─────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<PaperPositionStatus, string> = {
  PENDING_APPROVAL: '#94A3B8',
  APPROVED:         '#60A5FA',
  OPEN:             '#00E5A8',
  PARTIAL:          '#FBBF24',
  CLOSED:           '#64748B',
  REJECTED:         '#FF3B5C',
  CANCELLED:        '#FF3B5C',
  ERROR:            '#FF0040',
};

function RBadge({ value, prefix = '' }: { value: number; prefix?: string }) {
  const col = value > 0 ? '#00E5A8' : value < 0 ? '#FF3B5C' : '#94A3B8';
  return (
    <span className="tabular-nums font-mono text-[11px]" style={{ color: col }}>
      {prefix}{value >= 0 ? '+' : ''}{value.toFixed(2)}R
    </span>
  );
}

function PositionRow({ p }: { p: PaperPosition }) {
  const col   = STATUS_COLOR[p.status] ?? '#94A3B8';
  const isOpen = p.status === 'OPEN' || p.status === 'PARTIAL';
  const dirCol = p.direction === 'LONG' ? '#00E5A8' : '#FF3B5C';

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0 gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[10px] font-bold shrink-0" style={{ color: dirCol }}>
          {p.direction === 'LONG' ? '▲' : '▼'}
        </span>
        <span className="text-[11px] font-semibold truncate">{p.symbol}</span>
        <span className="text-[9px] text-muted shrink-0">{p.timeframe}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isOpen && <RBadge value={p.unrealizedR} />}
        {!isOpen && <RBadge value={p.realizedR} />}
        <span
          className="text-[9px] font-semibold px-1 py-0.5 rounded"
          style={{ color: col, background: `${col}22` }}
        >
          {p.status}
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PaperPositionsPanel() {
  const { data, loading, error, updatedAt, refresh } = usePaperPositionsFeed();

  if (loading && !data) {
    return (
      <GlassCard>
        <p className="text-muted text-xs text-center py-4">Loading paper positions…</p>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard>
        <p className="text-[#FF3B5C] text-xs text-center py-4">{error}</p>
      </GlassCard>
    );
  }

  const summary        = data?.summary;
  const openPositions  = data?.openPositions  ?? [];
  const closedRecent   = (data?.closedPositions ?? []).slice(-5).reverse();
  const hasAny         = openPositions.length > 0 || closedRecent.length > 0;

  return (
    <GlassCard>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold text-muted tracking-wider uppercase">
          Paper Positions
        </h3>
        <button
          onClick={refresh}
          className="text-[9px] text-muted hover:text-white transition-colors"
        >
          ↻ refresh
        </button>
      </div>

      {/* Summary row */}
      {summary && (
        <div className="grid grid-cols-4 gap-2 mb-3 pb-2 border-b border-white/5">
          <div className="text-center">
            <div className="text-[16px] font-bold tabular-nums" style={{ color: '#60A5FA' }}>
              {summary.openCount}
            </div>
            <div className="text-[9px] text-muted">Open</div>
          </div>
          <div className="text-center">
            <RBadge value={summary.totalUnrealizedR} />
            <div className="text-[9px] text-muted mt-0.5">Unrealized</div>
          </div>
          <div className="text-center">
            <RBadge value={summary.totalRealizedR} />
            <div className="text-[9px] text-muted mt-0.5">Realized</div>
          </div>
          <div className="text-center">
            <div
              className="text-[14px] font-bold tabular-nums"
              style={{ color: summary.winRate >= 50 ? '#00E5A8' : '#FF3B5C' }}
            >
              {summary.closedCount > 0 ? `${summary.winRate.toFixed(0)}%` : '—'}
            </div>
            <div className="text-[9px] text-muted">Win rate</div>
          </div>
        </div>
      )}

      {/* Open positions */}
      {openPositions.length > 0 && (
        <div className="mb-2">
          <div className="text-[9px] font-semibold text-muted uppercase tracking-wider mb-1">
            Active ({openPositions.length})
          </div>
          {openPositions.map((p) => (
            <PositionRow key={p.positionId} p={p} />
          ))}
        </div>
      )}

      {/* Recent closed */}
      {closedRecent.length > 0 && (
        <div>
          <div className="text-[9px] font-semibold text-muted uppercase tracking-wider mb-1">
            Recent Closed
          </div>
          {closedRecent.map((p) => (
            <PositionRow key={p.positionId} p={p} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!hasAny && (
        <p className="text-muted text-[11px] text-center py-3">No paper positions yet</p>
      )}

      {/* Stats footer */}
      {summary && summary.closedCount > 0 && (
        <div className="mt-2 pt-2 border-t border-white/5 flex justify-between">
          <span className="text-[9px] text-muted">
            Avg win <span className="text-[#00E5A8]">+{summary.avgWinR.toFixed(2)}R</span>
          </span>
          <span className="text-[9px] text-muted">
            Avg loss <span className="text-[#FF3B5C]">{summary.avgLossR.toFixed(2)}R</span>
          </span>
          <span className="text-[9px] text-muted">
            {summary.winCount}W / {summary.lossCount}L
          </span>
        </div>
      )}

      {updatedAt && (
        <div className="mt-1 text-[8px] text-muted text-right">
          {updatedAt.toLocaleTimeString()}
        </div>
      )}
    </GlassCard>
  );
}
