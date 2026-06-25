import { logger } from '@/core/logger';
import {
  createBacktestSession,
  stepBacktestSession,
  runBacktestSession,
  pauseBacktestSession,
  resetBacktestSession,
  runWalkForward,
  DEFAULT_BACKTEST_CONFIG,
} from '@/lib/backtestEngine';
import type {
  BacktestSession, BacktestSessionSummary,
  BacktestStartRequest, BacktestRunRequest,
  BacktestApiResponse, BacktestListApiResponse,
  WalkForwardApiResponse, WalkForwardConfig,
} from '@/types';

const log = logger.withContext({ service: 'backtest' });

function summarize(s: BacktestSession): BacktestSessionSummary {
  return {
    backtestId:   s.replayId,
    symbol:       s.symbol,
    timeframe:    s.timeframe,
    status:       s.status,
    totalCandles: s.metrics.totalCandles,
    netR:         s.metrics.netR,
    sharpeRatio:  s.metrics.sharpeRatio,
    winRate:      s.metrics.winRate,
    overallScore: s.qualityScores.overallScore,
    createdAt:    s.createdAt,
  };
}

export class BacktestService {
  private _sessions: Map<string, BacktestSession> = new Map();

  getSessions(): BacktestListApiResponse {
    const sessions = Array.from(this._sessions.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(summarize);
    return { ok: true, sessions };
  }

  getSessionById(id: string): BacktestApiResponse {
    const s = this._sessions.get(id);
    if (!s) return { ok: false, session: null, error: `Backtest ${id} not found` };
    return { ok: true, session: s };
  }

  startSession(req: BacktestStartRequest): BacktestApiResponse {
    const { session, error } = createBacktestSession({
      symbol:    req.symbol,
      timeframe: req.timeframe,
      exchange:  req.exchange,
      candles:   req.candles,
      config:    req.config,
    });

    if (!session || error) {
      return { ok: false, session: null, error: error ?? 'Failed to create backtest session' };
    }

    this._sessions.set(session.replayId, session);
    log.info('session started', { backtestId: session.replayId, candles: req.candles.length });
    return { ok: true, session };
  }

  stepSession(backtestId: string): BacktestApiResponse {
    const s = this._sessions.get(backtestId);
    if (!s) return { ok: false, session: null, error: `Backtest ${backtestId} not found` };

    const { session: next, error } = stepBacktestSession(s);
    if (error) return { ok: false, session: null, error };

    this._sessions.set(backtestId, next);
    return { ok: true, session: next };
  }

  runSession(req: BacktestRunRequest): BacktestApiResponse {
    const s = this._sessions.get(req.backtestId);
    if (!s) return { ok: false, session: null, error: `Backtest ${req.backtestId} not found` };

    const { session: next, stepsRun, error } = runBacktestSession(s, req.maxSteps);
    if (error) return { ok: false, session: null, error };

    this._sessions.set(req.backtestId, next);
    log.info('run complete', { backtestId: req.backtestId, stepsRun, status: next.status });
    return { ok: true, session: next };
  }

  pauseSession(backtestId: string): BacktestApiResponse {
    const s = this._sessions.get(backtestId);
    if (!s) return { ok: false, session: null, error: `Backtest ${backtestId} not found` };

    const { session: next } = pauseBacktestSession(s);
    this._sessions.set(backtestId, next);
    return { ok: true, session: next };
  }

  resetSession(backtestId: string): BacktestApiResponse {
    const s = this._sessions.get(backtestId);
    if (!s) return { ok: false, session: null, error: `Backtest ${backtestId} not found` };

    const { session: next } = resetBacktestSession(s);
    this._sessions.set(backtestId, next);
    log.info('session reset', { backtestId });
    return { ok: true, session: next };
  }

  runWalkForwardAnalysis(
    req:      BacktestStartRequest,
    wfConfig: WalkForwardConfig,
  ): WalkForwardApiResponse {
    const config = { ...DEFAULT_BACKTEST_CONFIG, ...(req.config ?? {}) };
    const { result, error } = runWalkForward(
      req.candles,
      req.symbol,
      req.timeframe,
      req.exchange ?? 'SIMULATED',
      config,
      wfConfig,
    );

    if (!result || error) {
      return { ok: false, result: null, error: error ?? 'Walk-forward failed' };
    }

    log.info('walk-forward complete', {
      wfId:       result.wfId,
      windows:    result.windows.length,
      robustness: result.overallRobustnessScore,
    });
    return { ok: true, result };
  }
}

export const backtestService = new BacktestService();
