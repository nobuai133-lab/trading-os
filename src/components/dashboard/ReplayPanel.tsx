'use client';

import { useCallback } from 'react';
import GlassCard         from '@/components/ui/GlassCard';
import { useReplayFeed } from '@/hooks/useReplayFeed';
import type { ReplayStatus, ReplaySession, ReplayQualityScores } from '@/types';

// ── Style helpers ─────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<ReplayStatus, string> = {
  IDLE:      '#94A3B8',
  RUNNING:   '#60A5FA',
  PAUSED:    '#FBBF24',
  COMPLETED: '#00E5A8',
  FAILED:    '#FF3B5C',
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  const col = score >= 70 ? '#00E5A8' : score >= 50 ? '#FBBF24' : '#FF3B5C';
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[9px] text-muted">{label}</span>
        <span className="text-[10px] font-mono" style={{ color: col }}>{score}</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(71,85,105,0.25)' }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: col, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

function RVal({ v, label }: { v: number; label: string }) {
  const col = v > 0 ? '#00E5A8' : v < 0 ? '#FF3B5C' : '#94A3B8';
  return (
    <div className="text-center">
      <div className="text-[13px] font-bold tabular-nums" style={{ color: col }}>
        {v >= 0 ? '+' : ''}{v.toFixed(2)}R
      </div>
      <div className="text-[9px] text-muted">{label}</div>
    </div>
  );
}

// ── Demo candle builder (for the "Demo Run" button) ───────────────────────────

function buildDemoCandles(count = 30) {
  const base = 65_000;
  return Array.from({ length: count }, (_, i) => {
    const drift = i * 80;
    const p     = base + drift;
    return {
      timestamp: Date.now() - (count - i) * 3_600_000,
      open:   p,
      high:   p + 200 + Math.floor((i % 5) * 60),
      low:    p - 100 - Math.floor((i % 3) * 40),
      close:  p + 150,
      volume: 100 + i * 5,
    };
  });
}

// ── Session detail view ───────────────────────────────────────────────────────

function SessionDetail({
  session,
  onStep, onRun, onPause, onReset,
  loading,
}: {
  session:  ReplaySession;
  onStep:   () => void;
  onRun:    () => void;
  onPause:  () => void;
  onReset:  () => void;
  loading:  boolean;
}) {
  const m   = session.metrics;
  const q   = session.qualityScores;
  const col = STATUS_COLOR[session.status];
  const progress = session.candles.length > 0
    ? Math.round((session.metrics.processedCandles / session.candles.length) * 100)
    : 0;

  const last = session.decisions[session.decisions.length - 1] ?? null;
  const lastVeto = session.decisions.slice().reverse().find((d) => d.riskVetoReason) ?? null;

  const isRunning  = session.status === 'RUNNING';
  const canControl = session.status !== 'COMPLETED' && session.status !== 'FAILED';

  return (
    <div className="space-y-3">
      {/* Status + symbol row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold" style={{ color: col }}>
            ● {session.status}
          </span>
          <span className="text-[11px] font-semibold">{session.symbol}</span>
          <span className="text-[9px] text-muted">{session.timeframe}</span>
        </div>
        <span className="text-[9px] text-muted tabular-nums">
          {session.currentIndex + 1} / {session.candles.length}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-[9px] text-muted mb-0.5">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(71,85,105,0.25)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: col }}
          />
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-4 gap-1.5 py-2 border-y border-white/5">
        <RVal v={m.totalRealizedR}   label="Total R"   />
        <RVal v={-m.maxDrawdownR}    label="MaxDD"     />
        <RVal v={m.expectancyR}      label="Expect"    />
        <RVal v={-m.opportunityCostR} label="OppCost"  />
      </div>

      {/* Trade stats */}
      <div className="grid grid-cols-3 gap-1 text-center">
        <div>
          <div className="text-[13px] font-bold" style={{ color: '#00E5A8' }}>{m.tpHits}</div>
          <div className="text-[9px] text-muted">TP Hits</div>
        </div>
        <div>
          <div className="text-[13px] font-bold" style={{ color: '#FF3B5C' }}>{m.slHits}</div>
          <div className="text-[9px] text-muted">SL Hits</div>
        </div>
        <div>
          <div
            className="text-[13px] font-bold"
            style={{ color: m.winRate >= 50 ? '#00E5A8' : '#FF3B5C' }}
          >
            {(m.tpHits + m.slHits) > 0
              ? `${m.winRate.toFixed(0)}%`
              : '—'}
          </div>
          <div className="text-[9px] text-muted">Win Rate</div>
        </div>
      </div>

      {/* Quality scores */}
      <div className="space-y-1.5 pt-1">
        <div className="text-[9px] font-semibold text-muted uppercase tracking-wider">Quality Scores</div>
        <ScoreBar label="Decision"  score={q.decisionQualityScore}  />
        <ScoreBar label="Risk"      score={q.riskQualityScore}      />
        <ScoreBar label="Memory"    score={q.memoryQualityScore}    />
        <ScoreBar label="Lifecycle" score={q.lifecycleQualityScore} />
        <div className="flex justify-between items-center pt-0.5">
          <span className="text-[9px] text-muted font-semibold">Overall</span>
          <span
            className="text-[13px] font-bold tabular-nums"
            style={{ color: q.overallScore >= 70 ? '#00E5A8' : q.overallScore >= 50 ? '#FBBF24' : '#FF3B5C' }}
          >
            {q.overallScore}
          </span>
        </div>
      </div>

      {/* Last decision / veto */}
      {last && (
        <div className="pt-1 text-[9px] text-muted border-t border-white/5">
          <span className="font-semibold">Last:</span>{' '}
          <span style={{ color: last.decision === 'LONG' ? '#00E5A8' : last.decision === 'SHORT' ? '#FF3B5C' : '#94A3B8' }}>
            {last.decision}
          </span>
          {' '}({last.confidence}%)
          {last.riskVetoReason && (
            <span className="ml-1 text-[#FBBF24]">⚠ {last.riskVetoReason}</span>
          )}
        </div>
      )}
      {lastVeto && !last?.riskVetoReason && (
        <div className="text-[9px] text-muted">
          <span className="text-[#FBBF24]">Last veto:</span> {lastVeto.riskVetoReason}
        </div>
      )}

      {/* Controls */}
      {canControl && (
        <div className="flex gap-1.5 pt-1">
          <button
            onClick={onStep}
            disabled={loading || !canControl}
            className="flex-1 text-[10px] py-1 rounded font-semibold transition-colors"
            style={{ background: 'rgba(96,165,250,0.15)', color: '#60A5FA' }}
          >
            Step
          </button>
          {isRunning ? (
            <button
              onClick={onPause}
              disabled={loading}
              className="flex-1 text-[10px] py-1 rounded font-semibold transition-colors"
              style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}
            >
              Pause
            </button>
          ) : (
            <button
              onClick={onRun}
              disabled={loading}
              className="flex-1 text-[10px] py-1 rounded font-semibold transition-colors"
              style={{ background: 'rgba(0,229,168,0.15)', color: '#00E5A8' }}
            >
              Run
            </button>
          )}
          <button
            onClick={onReset}
            disabled={loading}
            className="flex-1 text-[10px] py-1 rounded font-semibold transition-colors"
            style={{ background: 'rgba(255,59,92,0.10)', color: '#FF3B5C' }}
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReplayPanel() {
  const {
    sessions, activeSession, loading, error,
    startReplay, stepReplay, runReplay, pauseReplay, resetReplay,
  } = useReplayFeed();

  const handleDemo = useCallback(async () => {
    const candles = buildDemoCandles(30);
    await startReplay(candles, 'BTCUSDT', '4H');
  }, [startReplay]);

  const id = activeSession?.replayId;

  return (
    <GlassCard>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold text-muted tracking-wider uppercase">
          Replay Engine
        </h3>
        {!activeSession && (
          <button
            onClick={handleDemo}
            disabled={loading}
            className="text-[9px] px-2 py-0.5 rounded font-semibold"
            style={{ background: 'rgba(96,165,250,0.15)', color: '#60A5FA' }}
          >
            Demo Run
          </button>
        )}
        {activeSession && (
          <button
            onClick={handleDemo}
            disabled={loading}
            className="text-[9px] text-muted hover:text-white transition-colors"
          >
            + New
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-[#FF3B5C] text-[10px] mb-2">{error}</p>
      )}

      {/* Active session */}
      {activeSession ? (
        <SessionDetail
          session={activeSession}
          onStep={()  => id && stepReplay(id)}
          onRun={()   => id && runReplay(id)}
          onPause={()  => id && pauseReplay(id)}
          onReset={()  => id && resetReplay(id)}
          loading={loading}
        />
      ) : (
        <div className="text-center py-4">
          <p className="text-muted text-[11px]">No active replay session</p>
          <p className="text-muted text-[9px] mt-1">Click "Demo Run" to simulate 30 BTC candles</p>
        </div>
      )}

      {/* Sessions list */}
      {sessions.length > 1 && (
        <div className="mt-3 pt-2 border-t border-white/5">
          <div className="text-[9px] font-semibold text-muted uppercase tracking-wider mb-1.5">
            Sessions ({sessions.length})
          </div>
          {sessions.slice(0, 4).map((s) => (
            <div
              key={s.replayId}
              className="flex items-center justify-between py-1 border-b border-white/5 last:border-0 cursor-pointer"
            >
              <span className="text-[10px]">{s.symbol} {s.timeframe}</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] tabular-nums" style={{ color: s.totalRealizedR >= 0 ? '#00E5A8' : '#FF3B5C' }}>
                  {s.totalRealizedR >= 0 ? '+' : ''}{s.totalRealizedR.toFixed(2)}R
                </span>
                <span className="text-[9px]" style={{ color: STATUS_COLOR[s.status] }}>
                  {s.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
