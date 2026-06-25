'use client';

import type { DashboardState } from '@/types';
import { LIFECYCLE_STEPS } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import DecisionHero from '@/components/ui/DecisionHero';
import ConfidenceRing from '@/components/ui/ConfidenceRing';
import AgentBadge from '@/components/ui/AgentBadge';
import SetupScannerCard from '@/components/ui/SetupScannerCard';

const REGIME_COLORS: Record<string, string> = {
  BULL:         '#00E5A8',
  BEAR:         '#FF3B5C',
  RANGE:        '#64748B',
  TRANSITION:   '#FBBF24',
  DISTRIBUTION: '#A78BFA',
  ACCUMULATION: '#38BDF8',
};

const BIAS_COLORS: Record<string, string> = {
  BEARISH: '#FF3B5C',
  BULLISH: '#00E5A8',
  NEUTRAL: '#64748B',
};

interface Props {
  state: DashboardState;
}

export default function CommandCenter({ state }: Props) {
  const lifecycleLabel = LIFECYCLE_STEPS[state.lifecycleIndex]?.label ?? 'Unknown';

  return (
    <div className="flex flex-col gap-3">
      {/* Decision Hero */}
      <DecisionHero
        decision={state.decision}
        mode={state.mode}
        lifecycleLabel={lifecycleLabel}
      />

      {/* Confidence + Meta */}
      <div className="flex gap-3">
        {/* Ring */}
        <GlassCard className="flex items-center justify-center" padding="p-4">
          <ConfidenceRing
            value={state.confidence}
            decayEvents={state.decayEvents}
          />
        </GlassCard>

        {/* Meta grid */}
        <GlassCard className="flex-1" padding="p-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            {/* Regime */}
            <div className="flex flex-col gap-0.5">
              <span className="card-label">Regime</span>
              <span
                className="text-[13px] font-bold"
                style={{ color: REGIME_COLORS[state.regime] ?? '#64748B' }}
              >
                {state.regime}
              </span>
            </div>
            {/* Grade */}
            <div className="flex flex-col gap-0.5">
              <span className="card-label">Grade</span>
              <span className="text-[13px] font-bold text-text">{state.riskGrade}</span>
            </div>
            {/* HTF Bias */}
            <div className="flex flex-col gap-0.5">
              <span className="card-label">HTF Bias</span>
              <span
                className="text-[12px] font-semibold"
                style={{ color: BIAS_COLORS[state.htfBias] ?? '#64748B' }}
              >
                {state.htfBias}
              </span>
            </div>
            {/* LTF Bias */}
            <div className="flex flex-col gap-0.5">
              <span className="card-label">LTF Bias</span>
              <span
                className="text-[12px] font-semibold"
                style={{ color: BIAS_COLORS[state.ltfBias] ?? '#64748B' }}
              >
                {state.ltfBias}
              </span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Setup Scanner — only when pre-entry setups are being tracked */}
      {state.pendingSetups && state.pendingSetups.length > 0 && (
        <SetupScannerCard setups={state.pendingSetups} currentPrice={state.price} />
      )}

      {/* Agent Consensus */}
      <GlassCard>
        <p className="card-title">Agent Consensus</p>
        <div className="grid grid-cols-2 gap-1.5">
          {state.agents.map((agent) => (
            <AgentBadge key={agent.id} agent={agent} />
          ))}
        </div>
      </GlassCard>

      {/* Memory snapshot */}
      <GlassCard>
        <p className="card-title">Previous Trade</p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-chip"
              style={{
                color:      state.memory.direction === 'SHORT' ? '#FF3B5C' : state.memory.direction === 'LONG' ? '#00E5A8' : '#64748B',
                background: state.memory.direction === 'SHORT' ? 'rgba(255,59,92,0.12)' : state.memory.direction === 'LONG' ? 'rgba(0,229,168,0.12)' : 'rgba(100,116,139,0.12)',
                border:     `1px solid ${state.memory.direction === 'SHORT' ? 'rgba(255,59,92,0.25)' : state.memory.direction === 'LONG' ? 'rgba(0,229,168,0.25)' : 'rgba(100,116,139,0.25)'}`,
              }}
            >
              {state.memory.direction}
            </span>
            <span className="text-[10px] text-muted2 font-mono">{state.memory.tradeId}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[15px] font-black"
              style={{
                color: state.memory.result.startsWith('+') ? '#00E5A8' : state.memory.result.startsWith('-') ? '#FF3B5C' : '#64748B',
              }}
            >
              {state.memory.result}
            </span>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
              style={{
                color:      state.memory.biasCarryover ? '#FBBF24' : '#64748B',
                background: state.memory.biasCarryover ? 'rgba(251,191,36,0.12)' : 'rgba(100,116,139,0.10)',
                border:     `1px solid ${state.memory.biasCarryover ? 'rgba(251,191,36,0.25)' : 'rgba(100,116,139,0.2)'}`,
              }}
            >
              {state.memory.biasCarryover ? 'CARRY' : 'RESET'}
            </span>
          </div>
        </div>
        <p className="text-[10px] text-muted2 mt-2 leading-snug">{state.memory.lesson}</p>
      </GlassCard>
    </div>
  );
}
