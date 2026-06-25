'use client';

import { useState, useEffect } from 'react';
import type { DashboardState } from '@/types';
import { LIFECYCLE_STEPS } from '@/types';
import { resolveAntiReentryDecision, buildHumanMessage } from '@/lib/antiOvertrading';
import GlassCard from '@/components/ui/GlassCard';
import DecisionHero from '@/components/ui/DecisionHero';
import ConfidenceRing from '@/components/ui/ConfidenceRing';
import AgentBadge from '@/components/ui/AgentBadge';
import SetupScannerCard from '@/components/ui/SetupScannerCard';
import CooldownBanner from '@/components/ui/CooldownBanner';
import RangeStatusCard from '@/components/ui/RangeStatusCard';
import SetupFingerprintCard from '@/components/ui/SetupFingerprintCard';
import KeyLevelsCard from '@/components/ui/KeyLevelsCard';

const ANALYSIS_INTERVAL_MS = 15 * 60_000;

function useNextRefresh() {
  const [secsLeft, setSecsLeft] = useState(ANALYSIS_INTERVAL_MS / 1000);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, ANALYSIS_INTERVAL_MS - (elapsed % ANALYSIS_INTERVAL_MS));
      setSecsLeft(Math.ceil(remaining / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const m = Math.floor(secsLeft / 60);
  const s = secsLeft % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

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

export default function ScannerPanel({ state }: Props) {
  const lifecycleLabel = LIFECYCLE_STEPS[state.lifecycleIndex]?.label ?? 'Unknown';
  const hasSetups      = state.pendingSetups && state.pendingSetups.length > 0;
  const nextRefresh    = useNextRefresh();

  const antiReentry = state.antiReentry ?? null;
  const ar          = antiReentry
    ? resolveAntiReentryDecision(antiReentry, state.decision)
    : null;
  const humanMsg    = antiReentry?.blocked ? buildHumanMessage(antiReentry) : null;

  const displayDecision = ar ? ar.decision : state.decision;

  return (
    <div className="flex flex-col gap-3">
      {/* Cooldown banner — shown above everything when active */}
      {antiReentry?.cooldown.active && antiReentry.cooldown.remainingBars > 0 && (
        <CooldownBanner cooldown={antiReentry.cooldown} />
      )}

      {/* Decision + mode */}
      <DecisionHero
        decision={displayDecision}
        mode={state.mode}
        lifecycleLabel={lifecycleLabel}
      />

      {/* Confidence ring + market meta */}
      <div className="flex gap-3">
        <GlassCard className="flex items-center justify-center" padding="p-4">
          <ConfidenceRing value={state.confidence} decayEvents={state.decayEvents} />
        </GlassCard>

        <GlassCard className="flex-1" padding="p-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            <div className="flex flex-col gap-0.5">
              <span className="card-label">Regime</span>
              <span className="text-[13px] font-bold" style={{ color: REGIME_COLORS[state.regime] ?? '#64748B' }}>
                {state.regime}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="card-label">Grade</span>
              <span className="text-[13px] font-bold text-text">{state.riskGrade}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="card-label">HTF Bias</span>
              <span className="text-[12px] font-semibold" style={{ color: BIAS_COLORS[state.htfBias] ?? '#64748B' }}>
                {state.htfBias}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="card-label">LTF Bias</span>
              <span className="text-[12px] font-semibold" style={{ color: BIAS_COLORS[state.ltfBias] ?? '#64748B' }}>
                {state.ltfBias}
              </span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Human message when blocked */}
      {humanMsg && (
        <div
          className="rounded-[10px] px-3 py-2.5"
          style={{
            background: 'rgba(251,191,36,0.06)',
            border:     '1px solid rgba(251,191,36,0.18)',
          }}
        >
          <p className="text-[10px] font-semibold leading-snug" style={{ color: '#FBBF24' }}>
            {humanMsg}
          </p>
        </div>
      )}

      {/* Setup Scanner — always shown, with refresh countdown */}
      {hasSetups ? (
        <div>
          <div className="flex items-center justify-between px-1 mb-1.5">
            <span className="text-[9px] text-muted2 font-medium">Scanner · live</span>
            <span className="text-[9px] text-muted2">next refresh <span className="font-mono text-muted">{nextRefresh}</span></span>
          </div>
          <SetupScannerCard setups={state.pendingSetups!} currentPrice={state.price} />
        </div>
      ) : (
        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <p className="card-title mb-0">Setup Scanner</p>
            <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: '#64748B' }}>
              0 active
            </span>
          </div>
          <div className="flex flex-col items-center justify-center py-4 gap-2">
            <span className="text-[22px] opacity-20">◎</span>
            <p className="text-[10px] text-muted2 text-center">
              No setups identified. Waiting for structure.
            </p>
          </div>
        </GlassCard>
      )}

      {/* Range Memory + Fingerprint cards — shown when anti-reentry is active */}
      {antiReentry?.rangeMemory && (
        <RangeStatusCard rangeMemory={antiReentry.rangeMemory} />
      )}
      {antiReentry?.setupFingerprint && (
        <SetupFingerprintCard fingerprint={antiReentry.setupFingerprint} />
      )}

      {/* Next required conditions */}
      {antiReentry?.blocked && antiReentry.nextRequiredConditions.length > 0 && (
        <GlassCard padding="p-3">
          <p className="card-title mb-2">Required to Re-enter</p>
          <div className="flex flex-col gap-1">
            {antiReentry.nextRequiredConditions.map((cond, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[9px] mt-0.5 shrink-0" style={{ color: '#475569' }}>○</span>
                <span className="text-[9px] text-muted2">{cond}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Key Levels */}
      {state.keyLevels && state.keyLevels.length > 0 && (
        <KeyLevelsCard levels={state.keyLevels} currentPrice={state.price} />
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
    </div>
  );
}
