'use client';

import type { PendingSetup, SetupStatus, SetupLifecycleStatus } from '@/types';
import GlassCard from '@/components/ui/GlassCard';

const STATUS_STYLE: Record<SetupStatus, { color: string; bg: string; border: string; label: string }> = {
  WATCHING:    { color: '#FBBF24', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.25)',  label: 'WATCHING'    },
  TRIGGERED:   { color: '#00E5A8', bg: 'rgba(0,229,168,0.10)',  border: 'rgba(0,229,168,0.25)',   label: 'TRIGGERED'   },
  INVALIDATED: { color: '#FF3B5C', bg: 'rgba(255,59,92,0.08)',  border: 'rgba(255,59,92,0.22)',   label: 'INVALIDATED' },
};

const LIFECYCLE_COLOR: Record<SetupLifecycleStatus, string> = {
  NEW:         '#38BDF8',
  ACTIVE:      '#00E5A8',
  TRADED:      '#FBBF24',
  COMPLETED:   '#A78BFA',
  EXPIRED:     '#FF3B5C',
  INVALIDATED: '#FF3B5C',
  STALE:       '#64748B',
};

const GRADE_COLOR: Record<string, string> = {
  'A+': '#00E5A8', 'A': '#00E5A8', 'B': '#FBBF24', 'C': '#FF3B5C', '—': '#64748B',
};

interface Props {
  setups:       PendingSetup[];
  currentPrice: number;
}

export default function SetupScannerCard({ setups, currentPrice }: Props) {
  if (!setups.length) return null;

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-2">
        <p className="card-title mb-0">Setup Scanner</p>
        <span className="text-[9px] font-bold tracking-widest uppercase text-muted2">
          {setups.filter(s => s.status !== 'INVALIDATED').length} active
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {setups.map((setup) => {
          const ss    = STATUS_STYLE[setup.status];
          const inZ   = currentPrice >= setup.entryZone.low && currentPrice <= setup.entryZone.high;
          const dirColor = setup.direction === 'SHORT' ? '#FF3B5C' : '#00E5A8';

          return (
            <div
              key={setup.id}
              className="rounded-[10px] p-2.5"
              style={{
                background: ss.bg,
                border:     `1px solid ${ss.border}`,
                opacity:    setup.status === 'INVALIDATED' ? 0.5 : 1,
              }}
            >
              {/* Row 1: label + direction + grade + status */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-black" style={{ color: ss.color }}>
                  {setup.label}
                </span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-chip"
                  style={{ color: dirColor, background: `${dirColor}14`, border: `1px solid ${dirColor}28` }}
                >
                  {setup.direction}
                </span>
                <span
                  className="text-[9px] font-bold"
                  style={{ color: GRADE_COLOR[setup.grade] }}
                >
                  {setup.grade}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  {setup.lifecycleStatus && (
                    <span
                      className="text-[7px] font-bold px-1 py-0.5 rounded-chip tracking-wider"
                      style={{
                        color:      LIFECYCLE_COLOR[setup.lifecycleStatus],
                        background: `${LIFECYCLE_COLOR[setup.lifecycleStatus]}14`,
                        border:     `1px solid ${LIFECYCLE_COLOR[setup.lifecycleStatus]}30`,
                      }}
                    >
                      {setup.lifecycleStatus}
                    </span>
                  )}
                  <span className="text-[8px] font-bold tracking-wider" style={{ color: ss.color }}>
                    {ss.label}
                  </span>
                </div>
              </div>

              {/* Row 2: entry zone */}
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-[9px] text-muted2 w-10">ZONE</span>
                <span
                  className="text-[11px] font-bold tabular-nums"
                  style={{ color: inZ ? '#FBBF24' : '#F8FAFC' }}
                >
                  ${setup.entryZone.low.toLocaleString()} – ${setup.entryZone.high.toLocaleString()}
                </span>
                {inZ && (
                  <span
                    className="ml-1 text-[8px] font-bold px-1.5 py-0.5 rounded-chip"
                    style={{ color: '#FBBF24', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)' }}
                  >
                    PRICE IN ZONE
                  </span>
                )}
              </div>

              {/* Row 3: SL + TPs in one line */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: 'SL',  value: setup.sl,  color: '#FF3B5C' },
                  { label: 'TP1', value: setup.tp1, color: '#00E5A8' },
                  { label: 'TP2', value: setup.tp2, color: '#00E5A8' },
                  { label: 'TP3', value: setup.tp3, color: '#00E5A8' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-[8px] text-muted2 font-bold tracking-wider">{label}</span>
                    <span className="text-[10px] font-semibold tabular-nums" style={{ color }}>
                      ${Math.round(value / 100) * 100 === value
                        ? value.toLocaleString()
                        : value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              {/* Row 4: RR + note */}
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[9px] text-muted2">{setup.note}</span>
                <span className="text-[9px] font-bold text-blue">RR {setup.rr.toFixed(1)}R</span>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
