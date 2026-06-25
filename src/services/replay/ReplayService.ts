import { logger }             from '@/core/logger';
import {
  createReplaySession,
  stepReplaySession,
  runReplaySession,
  pauseReplaySession,
  resetReplaySession,
} from '@/lib/replayEngine';
import type {
  ReplaySession, ReplaySessionSummary,
  ReplayStartRequest, ReplayRunRequest,
  ReplayApiResponse,
} from '@/types';

const log = logger.withContext({ service: 'replay' });

function summarize(s: ReplaySession): ReplaySessionSummary {
  const total    = s.candles.length;
  const processed = s.metrics.processedCandles;
  return {
    replayId:        s.replayId,
    symbol:          s.symbol,
    timeframe:       s.timeframe,
    status:          s.status,
    totalCandles:    total,
    processedCandles: processed,
    progress:        total > 0 ? Math.round((processed / total) * 1000) / 10 : 0,
    totalRealizedR:  s.metrics.totalRealizedR,
    winRate:         s.metrics.winRate,
    overallScore:    s.qualityScores.overallScore,
    createdAt:       s.createdAt,
    updatedAt:       s.updatedAt,
  };
}

// ── ReplayService ─────────────────────────────────────────────────────────────

export class ReplayService {
  private _sessions: Map<string, ReplaySession> = new Map();

  // ── Queries ───────────────────────────────────────────────────────────────

  getSessions(): ReplaySessionSummary[] {
    return Array.from(this._sessions.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(summarize);
  }

  getSessionById(id: string): ReplaySession | null {
    return this._sessions.get(id) ?? null;
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  startSession(req: ReplayStartRequest): ReplayApiResponse {
    const { session, error } = createReplaySession({
      symbol:          req.symbol,
      timeframe:       req.timeframe,
      exchange:        req.exchange,
      candles:         req.candles,
      maxStepsPerRun:  req.maxStepsPerRun,
    });

    if (!session || error) {
      return { ok: false, session: null, error: error ?? 'Failed to create session' };
    }

    this._sessions.set(session.replayId, session);
    log.info('session started', { replayId: session.replayId, candles: req.candles.length });
    return { ok: true, session, error: undefined };
  }

  stepSession(replayId: string): ReplayApiResponse {
    const s = this._sessions.get(replayId);
    if (!s) return { ok: false, session: null, error: `Session ${replayId} not found` };

    const { session: next, error } = stepReplaySession(s);
    if (error) return { ok: false, session: null, error };

    this._sessions.set(replayId, next);
    return { ok: true, session: next };
  }

  runSession(req: ReplayRunRequest): ReplayApiResponse {
    const s = this._sessions.get(req.replayId);
    if (!s) return { ok: false, session: null, error: `Session ${req.replayId} not found` };

    const { session: next, stepsRun, error } = runReplaySession(s, req.maxSteps);
    if (error) return { ok: false, session: null, error };

    this._sessions.set(req.replayId, next);
    log.info('run complete', { replayId: req.replayId, stepsRun, status: next.status });
    return { ok: true, session: next };
  }

  pauseSession(replayId: string): ReplayApiResponse {
    const s = this._sessions.get(replayId);
    if (!s) return { ok: false, session: null, error: `Session ${replayId} not found` };

    const { session: next } = pauseReplaySession(s);
    this._sessions.set(replayId, next);
    return { ok: true, session: next };
  }

  resetSession(replayId: string): ReplayApiResponse {
    const s = this._sessions.get(replayId);
    if (!s) return { ok: false, session: null, error: `Session ${replayId} not found` };

    const { session: next } = resetReplaySession(s);
    this._sessions.set(replayId, next);
    log.info('session reset', { replayId });
    return { ok: true, session: next };
  }
}

export const replayService = new ReplayService();
