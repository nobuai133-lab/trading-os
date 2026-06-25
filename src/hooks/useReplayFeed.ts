'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  ReplaySession, ReplaySessionSummary,
  ReplayStartRequest, ReplayCandle,
} from '@/types';

const POLL_INTERVAL_MS = 10_000;

export interface ReplayFeedState {
  sessions:        ReplaySessionSummary[];
  activeSession:   ReplaySession | null;
  loading:         boolean;
  error:           string | null;
  updatedAt:       Date | null;
  // Actions
  startReplay:     (candles: ReplayCandle[], symbol?: string, timeframe?: string) => Promise<void>;
  stepReplay:      (replayId: string) => Promise<void>;
  runReplay:       (replayId: string, maxSteps?: number) => Promise<void>;
  pauseReplay:     (replayId: string) => Promise<void>;
  resetReplay:     (replayId: string) => Promise<void>;
  selectSession:   (replayId: string) => Promise<void>;
  refresh:         () => void;
}

const HEADERS = { 'Content-Type': 'application/json' };

export function useReplayFeed(): ReplayFeedState {
  const [sessions,      setSessions]      = useState<ReplaySessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<ReplaySession | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [updatedAt,     setUpdatedAt]     = useState<Date | null>(null);

  const fetchList = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/replay', { cache: 'no-store' });
      if (!r.ok) return;
      const json = await r.json();
      if (json?.ok) {
        setSessions(json.sessions ?? []);
        setUpdatedAt(new Date());
      }
    } catch { /* non-fatal poll failure */ }
  }, []);

  useEffect(() => {
    fetchList();
    const id = setInterval(fetchList, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchList]);

  const handleResult = useCallback((json: { ok: boolean; session?: ReplaySession; error?: string }) => {
    if (!json.ok) {
      setError(json.error ?? 'Unknown error');
      return;
    }
    if (json.session) setActiveSession(json.session);
    setError(null);
    setUpdatedAt(new Date());
    void fetchList();
  }, [fetchList]);

  const startReplay = useCallback(async (
    candles:   ReplayCandle[],
    symbol    = 'BTCUSDT',
    timeframe = '4H',
  ) => {
    setLoading(true);
    try {
      const body: ReplayStartRequest = { symbol, timeframe, candles };
      const r    = await fetch('/api/v1/replay/start', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
      const json = await r.json();
      handleResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [handleResult]);

  const stepReplay = useCallback(async (replayId: string) => {
    setLoading(true);
    try {
      const r    = await fetch('/api/v1/replay/step', { method: 'POST', headers: HEADERS, body: JSON.stringify({ replayId }) });
      const json = await r.json();
      handleResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [handleResult]);

  const runReplay = useCallback(async (replayId: string, maxSteps?: number) => {
    setLoading(true);
    try {
      const r    = await fetch('/api/v1/replay/run', { method: 'POST', headers: HEADERS, body: JSON.stringify({ replayId, maxSteps }) });
      const json = await r.json();
      handleResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [handleResult]);

  const pauseReplay = useCallback(async (replayId: string) => {
    try {
      const r    = await fetch('/api/v1/replay/pause', { method: 'POST', headers: HEADERS, body: JSON.stringify({ replayId }) });
      const json = await r.json();
      handleResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    }
  }, [handleResult]);

  const resetReplay = useCallback(async (replayId: string) => {
    try {
      const r    = await fetch('/api/v1/replay/reset', { method: 'POST', headers: HEADERS, body: JSON.stringify({ replayId }) });
      const json = await r.json();
      handleResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    }
  }, [handleResult]);

  const selectSession = useCallback(async (replayId: string) => {
    try {
      const r    = await fetch(`/api/v1/replay/${replayId}`, { cache: 'no-store' });
      const json = await r.json();
      if (json?.ok && json.session) setActiveSession(json.session);
    } catch { /* non-fatal */ }
  }, []);

  return {
    sessions, activeSession, loading, error, updatedAt,
    startReplay, stepReplay, runReplay, pauseReplay, resetReplay,
    selectSession, refresh: fetchList,
  };
}
