'use client';

import { useCallback, useState } from 'react';
import GlassCard            from '@/components/ui/GlassCard';
import { useBacktestFeed }  from '@/hooks/useBacktestFeed';
import type { BacktestSession, WalkForwardResult, ReplayStatus } from '@/types';

// ── Style helpers ─────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<ReplayStatus, string> = {
  IDLE:      '#94A3B8',
  RUNNING:   '#60A5FA',
  PAUSED:    '#FBBF24',
  COMPLETED: '#00E5A8',
  FAILED:    '#FF3B5C',
};

function MetricCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-[13px] font-bold tabular-nums" style={{ color: color ?? '#E2E8F0' }}>
        {value}
      </div>
      <div className="text-[9px] text-muted">{label}</div>
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

// ── Walk-forward result display ───────────────────────────────────────────────

function WalkForwardView({ result }: { result: WalkForwardResult }) {
  const col = result.overallRobustnessScore >= 60 ? '#00E5A8'
    : result.overallRobustnessScore >= 40 ? '#FBBF24'
    : '#FF3B5C';

  return (
    <div className="mt-3 pt-2 border-t border-white/5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold text-muted uppercase tracking-wider">Walk-Forward</span>
        <span className="text-[12px] font-bold" style={{ color: col }}>
          {result.overallRobustnessScore}% robust
        </span>
      </div>

      {/* Aggregate IS vs OOS */}
      <div className="grid grid-cols-2 gap-1">
        <div className="text-center py-1 rounded" style={{ background: 'rgba(96,165,250,0.08)' }}>
          <div className="text-[11px] font-bold tabular-nums"
            style={{ color: result.aggregateInSampleNetR >= 0 ? '#60A5FA' : '#FF3B5C' }}>
            {result.aggregateInSampleNetR >= 0 ? '+' : ''}{result.aggregateInSampleNetR.toFixed(2)}R
          </div>
          <div className="text-[9px] text-muted">IS Net R</div>
        </div>
        <div className="text-center py-1 rounded" style={{ background: 'rgba(0,229,168,0.08)' }}>
          <div className="text-[11px] font-bold tabular-nums"
            style={{ color: result.aggregateOutOfSampleNetR >= 0 ? '#00E5A8' : '#FF3B5C' }}>
            {result.aggregateOutOfSampleNetR >= 0 ? '+' : ''}{result.aggregateOutOfSampleNetR.toFixed(2)}R
          </div>
          <div className="text-[9px] text-muted">OOS Net R</div>
        </div>
      </div>

      {/* Per-window robustness bars */}
      <div className="space-y-1">
        {result.windows.map((w) => {
          const wCol = w.robustnessScore >= 60 ? '#00E5A8'
            : w.robustnessScore >= 40 ? '#FBBF24' : '#FF3B5C';
          return (
            <div key={w.window.windowIndex} className="flex items-center gap-2">
              <span className="text-[9px] text-muted w-12 shrink-0">
                W{w.window.windowIndex + 1}
              </span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(71,85,105,0.25)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${w.robustnessScore}%`, background: wCol }}
                />
              </div>
              <span className="text-[9px] font-mono w-8 text-right" style={{ color: wCol }}>
                {w.robustnessScore}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Session detail view ───────────────────────────────────────────────────────

function SessionDetail({
  session, wfResult,
  onStep, onRun, onReset,
  loading,
}: {
  session:   BacktestSession;
  wfResult:  WalkForwardResult | null;
  onStep:    () => void;
  onRun:     () => void;
  onReset:   () => void;
  loading:   boolean;
}) {
  const m   = session.metrics;
  const q   = session.qualityScores;
  const col = STATUS_COLOR[session.status];

  const progress = session.candles.length > 0
    ? Math.round((m.processedCandles / session.candles.length) * 100)
    : 0;

  const isRunning  = session.status === 'RUNNING';
  const canControl = session.status !== 'COMPLETED' && session.status !== 'FAILED';

  return (
    <div className="space-y-3">
      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold" style={{ color: col }}>● {session.status}</span>
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

      {/* Net R + fees grid */}
      <div className="grid grid-cols-4 gap-1.5 py-2 border-y border-white/5">
        <RVal v={m.netR}           label="Net R"   />
        <RVal v={-m.maxDrawdownR}  label="MaxDD"   />
        <MetricCell label="Sharpe"  value={m.sharpeRatio.toFixed(2)}  color={m.sharpeRatio >= 0.5 ? '#00E5A8' : m.sharpeRatio >= 0 ? '#FBBF24' : '#FF3B5C'} />
        <MetricCell label="Calmar"  value={m.calmarRatio === 999 ? '∞' : m.calmarRatio.toFixed(1)} color={m.calmarRatio > 1 ? '#00E5A8' : '#FBBF24'} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-1 text-center">
        <div>
          <div className="text-[13px] font-bold" style={{ color: m.profitFactor >= 1.5 ? '#00E5A8' : '#FBBF24' }}>
            {m.profitFactor === 999 ? '∞' : m.profitFactor.toFixed(2)}
          </div>
          <div className="text-[9px] text-muted">PF</div>
        </div>
        <div>
          <div className="text-[13px] font-bold" style={{ color: m.winRate >= 50 ? '#00E5A8' : '#FF3B5C' }}>
            {(m.tpHits + m.slHits) > 0 ? `${m.winRate.toFixed(0)}%` : '—'}
          </div>
          <div className="text-[9px] text-muted">Win Rate</div>
        </div>
        <div>
          <div className="text-[13px] font-bold text-muted">
            -{m.totalFeesR.toFixed(2)}R
          </div>
          <div className="text-[9px] text-muted">Fees</div>
        </div>
      </div>

      {/* Fee config */}
      <div className="text-[9px] text-muted flex gap-3">
        <span>Fees: {(session.config.fees * 100).toFixed(2)}%</span>
        <span>Slip: {(session.config.slippage * 100).toFixed(3)}%</span>
        <span>Cap: ${session.config.initialCapital.toLocaleString()}</span>
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

      {/* Walk-forward result */}
      {wfResult && <WalkForwardView result={wfResult} />}

      {/* Controls */}
      {canControl && (
        <div className="flex gap-1.5 pt-1">
          <button
            onClick={onStep}
            disabled={loading || isRunning}
            className="flex-1 text-[10px] py-1 rounded font-semibold"
            style={{ background: 'rgba(96,165,250,0.15)', color: '#60A5FA' }}
          >
            Step
          </button>
          <button
            onClick={onRun}
            disabled={loading}
            className="flex-1 text-[10px] py-1 rounded font-semibold"
            style={{ background: 'rgba(0,229,168,0.15)', color: '#00E5A8' }}
          >
            Run
          </button>
          <button
            onClick={onReset}
            disabled={loading}
            className="flex-1 text-[10px] py-1 rounded font-semibold"
            style={{ background: 'rgba(255,59,92,0.10)', color: '#FF3B5C' }}
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

// ── Demo candle builders ──────────────────────────────────────────────────────

function buildDemoCandles(count = 60, bull = true) {
  const base = 65_000;
  return Array.from({ length: count }, (_, i) => {
    const drift = bull ? i * 100 : -i * 80;
    const p = base + drift;
    return {
      timestamp: Date.now() - (count - i) * 3_600_000,
      open:  p,
      high:  p + (bull ? 250 + (i % 5) * 50 : 80),
      low:   p - (bull ? 80 : 250 + (i % 5) * 50),
      close: p + (bull ? 180 : -180),
      volume: 120 + i * 4,
    };
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BacktestPanel() {
  const {
    sessions, activeSession, wfResult, loading, error,
    startBacktest, runBacktest, stepBacktest, resetBacktest,
    runWalkForward,
  } = useBacktestFeed();

  const [useWalkForward, setUseWalkForward] = useState(false);

  const handleDemo = useCallback(async () => {
    const candles = buildDemoCandles(60, true);
    if (useWalkForward) {
      await runWalkForward(candles, 'BTCUSDT', '4H');
    } else {
      const id = await startBacktest(candles, 'BTCUSDT', '4H');
      return id;
    }
  }, [useWalkForward, startBacktest, runWalkForward]);

  // After start, auto-run if no active session exists (convenience)
  const handleDemoAndRun = useCallback(async () => {
    const candles = buildDemoCandles(60, true);
    if (useWalkForward) {
      await runWalkForward(candles, 'BTCUSDT', '4H', undefined, { numWindows: 3, inSampleRatio: 0.7 });
    } else {
      await startBacktest(candles, 'BTCUSDT', '4H');
    }
  }, [useWalkForward, startBacktest, runWalkForward]);

  const id = activeSession?.replayId;

  return (
    <GlassCard>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold text-muted tracking-wider uppercase">
          Backtester
        </h3>
        <div className="flex items-center gap-2">
          {/* Walk-forward toggle */}
          <button
            onClick={() => setUseWalkForward((v) => !v)}
            className="text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors"
            style={{
              background: useWalkForward ? 'rgba(0,229,168,0.20)' : 'rgba(71,85,105,0.20)',
              color:      useWalkForward ? '#00E5A8' : '#94A3B8',
            }}
          >
            WF
          </button>

          {!activeSession ? (
            <button
              onClick={handleDemoAndRun}
              disabled={loading}
              className="text-[9px] px-2 py-0.5 rounded font-semibold"
              style={{ background: 'rgba(96,165,250,0.15)', color: '#60A5FA' }}
            >
              {useWalkForward ? 'Demo WF' : 'Demo Run'}
            </button>
          ) : (
            <button
              onClick={handleDemo}
              disabled={loading}
              className="text-[9px] text-muted hover:text-white transition-colors"
            >
              + New
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && <p className="text-[#FF3B5C] text-[10px] mb-2">{error}</p>}

      {/* Walk-forward result (no active session) */}
      {!activeSession && wfResult && (
        <WalkForwardView result={wfResult} />
      )}

      {/* Active session */}
      {activeSession ? (
        <SessionDetail
          session={activeSession}
          wfResult={wfResult}
          onStep={()  => id && stepBacktest(id)}
          onRun={()   => id && runBacktest(id)}
          onReset={()  => id && resetBacktest(id)}
          loading={loading}
        />
      ) : !wfResult && (
        <div className="text-center py-4">
          <p className="text-muted text-[11px]">No active backtest</p>
          <p className="text-muted text-[9px] mt-1">
            {useWalkForward
              ? 'Click "Demo WF" for walk-forward analysis (3 windows)'
              : 'Click "Demo Run" to backtest 60 BTC candles with fees'}
          </p>
        </div>
      )}

      {/* Sessions history */}
      {sessions.length > 0 && (
        <div className="mt-3 pt-2 border-t border-white/5">
          <div className="text-[9px] font-semibold text-muted uppercase tracking-wider mb-1.5">
            Sessions ({sessions.length})
          </div>
          {sessions.slice(0, 3).map((s) => (
            <div
              key={s.backtestId}
              className="flex items-center justify-between py-1 border-b border-white/5 last:border-0"
            >
              <span className="text-[10px]">{s.symbol} {s.timeframe}</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] tabular-nums" style={{ color: s.netR >= 0 ? '#00E5A8' : '#FF3B5C' }}>
                  {s.netR >= 0 ? '+' : ''}{s.netR.toFixed(2)}R
                </span>
                <span className="text-[9px] font-mono text-muted">
                  S:{s.sharpeRatio.toFixed(1)}
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
