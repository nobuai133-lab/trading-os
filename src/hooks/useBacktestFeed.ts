'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  BacktestSession, BacktestSessionSummary,
  BacktestListApiResponse, BacktestApiResponse,
  WalkForwardApiResponse, WalkForwardResult,
  ReplayCandle, BacktestConfig, WalkForwardConfig,
} from '@/types';

const POLL_MS = 15_000;

interface State {
  sessions:       BacktestSessionSummary[];
  activeSession:  BacktestSession | null;
  wfResult:       WalkForwardResult | null;
  loading:        boolean;
  error:          string | null;
  updatedAt:      number;
}

export function useBacktestFeed() {
  const [state, setState] = useState<State>({
    sessions:      [],
    activeSession: null,
    wfResult:      null,
    loading:       false,
    error:         null,
    updatedAt:     0,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res  = await fetch('/api/v1/backtest', { cache: 'no-store' });
      const data: BacktestListApiResponse = await res.json();
      if (data.ok) {
        setState((prev) => ({
          ...prev,
          sessions:  data.sessions,
          updatedAt: Date.now(),
          error:     null,
        }));
      }
    } catch (err) {
      setState((prev) => ({ ...prev, error: String(err) }));
    }
  }, []);

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [refresh]);

  const startBacktest = useCallback(async (
    candles:   ReplayCandle[],
    symbol:    string,
    timeframe: string,
    config?:   Partial<BacktestConfig>,
  ) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res  = await fetch('/api/v1/backtest/start', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ candles, symbol, timeframe, config }),
      });
      const data: BacktestApiResponse = await res.json();
      if (data.ok && data.session) {
        setState((prev) => ({ ...prev, activeSession: data.session!, loading: false }));
        refresh();
      } else {
        setState((prev) => ({ ...prev, loading: false, error: data.error ?? 'Start failed' }));
      }
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, error: String(err) }));
    }
  }, [refresh]);

  const runBacktest = useCallback(async (backtestId: string, maxSteps?: number) => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const res  = await fetch('/api/v1/backtest/run', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ backtestId, maxSteps }),
      });
      const data: BacktestApiResponse = await res.json();
      if (data.ok && data.session) {
        setState((prev) => ({ ...prev, activeSession: data.session!, loading: false }));
        refresh();
      } else {
        setState((prev) => ({ ...prev, loading: false, error: data.error ?? 'Run failed' }));
      }
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, error: String(err) }));
    }
  }, [refresh]);

  const stepBacktest = useCallback(async (backtestId: string) => {
    try {
      const res  = await fetch('/api/v1/backtest/step', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ backtestId }),
      });
      const data: BacktestApiResponse = await res.json();
      if (data.ok && data.session) {
        setState((prev) => ({ ...prev, activeSession: data.session! }));
      }
    } catch (err) {
      setState((prev) => ({ ...prev, error: String(err) }));
    }
  }, []);

  const resetBacktest = useCallback(async (backtestId: string) => {
    try {
      const res  = await fetch('/api/v1/backtest/reset', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ backtestId }),
      });
      const data: BacktestApiResponse = await res.json();
      if (data.ok && data.session) {
        setState((prev) => ({ ...prev, activeSession: data.session! }));
      }
    } catch (err) {
      setState((prev) => ({ ...prev, error: String(err) }));
    }
  }, []);

  const runWalkForward = useCallback(async (
    candles:   ReplayCandle[],
    symbol:    string,
    timeframe: string,
    config?:   Partial<BacktestConfig>,
    wfConfig?: WalkForwardConfig,
  ) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res  = await fetch('/api/v1/backtest/walk-forward', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ candles, symbol, timeframe, config, walkForward: wfConfig }),
      });
      const data: WalkForwardApiResponse = await res.json();
      if (data.ok && data.result) {
        setState((prev) => ({ ...prev, wfResult: data.result!, loading: false }));
      } else {
        setState((prev) => ({ ...prev, loading: false, error: data.error ?? 'Walk-forward failed' }));
      }
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, error: String(err) }));
    }
  }, []);

  const selectSession = useCallback(async (backtestId: string) => {
    try {
      const res  = await fetch(`/api/v1/backtest/${backtestId}`, { cache: 'no-store' });
      const data: BacktestApiResponse = await res.json();
      if (data.ok && data.session) {
        setState((prev) => ({ ...prev, activeSession: data.session! }));
      }
    } catch {
      // ignore
    }
  }, []);

  return {
    ...state,
    startBacktest,
    runBacktest,
    stepBacktest,
    resetBacktest,
    runWalkForward,
    selectSession,
    refresh,
  };
}
