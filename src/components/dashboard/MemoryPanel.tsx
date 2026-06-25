'use client';

import type { DashboardState, SystemMode } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import { fmt } from '@/lib/utils';

const MODE_LABELS: Record<SystemMode, string> = {
  IDLE:              'Idle',
  SETUP_DETECTED:    'Setup Detected',
  WAIT_CONFIRMATION: 'Wait Confirm',
  ENTRY_READY:       'Entry Ready',
  ACTIVE_TRADE:      'Active Trade',
  POST_TRADE_REVIEW: 'Post Review',
  WAIT_NEW_SETUP:    'Wait New Setup',
  COOLDOWN:          'Cooldown',
};

const MODE_COLORS: Record<SystemMode, string> = {
  IDLE:              '#64748B',
  SETUP_DETECTED:    '#38BDF8',
  WAIT_CONFIRMATION: '#FBBF24',
  ENTRY_READY:       '#A78BFA',
  ACTIVE_TRADE:      '#00E5A8',
  POST_TRADE_REVIEW: '#FBBF24',
  WAIT_NEW_SETUP:    '#38BDF8',
  COOLDOWN:          '#FF3B5C',
};

interface Props {
  state: DashboardState;
}

export default function MemoryPanel({ state }: Props) {
  const { memory } = state;

  const dirColor   = memory.direction === 'SHORT' ? '#FF3B5C' : memory.direction === 'LONG' ? '#00E5A8' : '#64748B';
  const resultPos  = memory.result.startsWith('+');
  const resultColor = resultPos ? '#00E5A8' : memory.result.startsWith('-') ? '#FF3B5C' : '#64748B';

  const levels = [
    { label: 'Entry', value: memory.entry },
    { label: 'TP1',   value: memory.tp1   },
    { label: 'TP2',   value: memory.tp2   },
    { label: 'TP3',   value: memory.tp3   },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Previous Trade */}
      <GlassCard>
        <p className="card-title">Previous Trade</p>

        <div className="flex items-center gap-3 mb-3">
          {/* Direction pill */}
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-chip"
            style={{
              color:      dirColor,
              background: `${dirColor}12`,
              border:     `1px solid ${dirColor}28`,
            }}
          >
            {memory.direction}
          </span>
          {/* ID */}
          <span className="text-[10px] text-muted2 font-mono">{memory.tradeId}</span>
          {/* TF */}
          <span className="text-[10px] font-semibold text-muted">{memory.timeframe}</span>
        </div>

        {/* Result — large */}
        <div
          className="text-[32px] font-black tabular-nums leading-none mb-4"
          style={{ color: resultColor }}
        >
          {memory.result}
        </div>

        {/* Levels */}
        <div className="grid grid-cols-4 gap-2">
          {levels.map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="card-label">{label}</span>
              <span className="text-[11px] font-semibold tabular-nums text-text">
                {value != null ? fmt(value) : '—'}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Bias Status */}
      <GlassCard>
        <p className="card-title">Bias Status</p>
        <div className="flex items-center gap-3">
          {/* Carryover */}
          <div className="flex flex-col gap-1">
            <span className="card-label">Bias Carryover</span>
            <span
              className="text-[12px] font-bold px-2 py-0.5 rounded-badge inline-block"
              style={{
                color:      memory.biasCarryover ? '#FBBF24' : '#64748B',
                background: memory.biasCarryover ? 'rgba(251,191,36,0.12)' : 'rgba(100,116,139,0.10)',
                border:     `1px solid ${memory.biasCarryover ? 'rgba(251,191,36,0.25)' : 'rgba(100,116,139,0.2)'}`,
              }}
            >
              {memory.biasCarryover ? 'YES — ACTIVE' : 'NO — RESET'}
            </span>
          </div>

          <div className="w-px h-8 bg-white/[0.06]" />

          {/* System mode */}
          <div className="flex flex-col gap-1">
            <span className="card-label">System Mode</span>
            <span
              className="text-[12px] font-bold px-2 py-0.5 rounded-badge inline-block"
              style={{
                color:      MODE_COLORS[memory.currentMode],
                background: `${MODE_COLORS[memory.currentMode]}12`,
                border:     `1px solid ${MODE_COLORS[memory.currentMode]}28`,
              }}
            >
              {MODE_LABELS[memory.currentMode]}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Lessons & Mistakes */}
      <GlassCard>
        <p className="card-title">Lessons & Mistakes</p>

        {/* Lesson */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green shrink-0" />
            <span className="text-[9px] font-bold tracking-widest uppercase text-green">
              Lesson
            </span>
          </div>
          <p className="text-[11px] text-muted leading-relaxed pl-3">
            {memory.lesson}
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/[0.05] mb-3" />

        {/* Mistake */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
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
    </div>
  );
}
