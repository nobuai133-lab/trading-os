'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PaperPositionApiResponse } from '@/types';

const POLL_INTERVAL_MS = 15_000;

export interface PaperPositionsFeedState {
  data:      PaperPositionApiResponse | null;
  loading:   boolean;
  error:     string | null;
  updatedAt: Date | null;
  refresh:   () => void;
}

export function usePaperPositionsFeed(): PaperPositionsFeedState {
  const [state, setState] = useState<Omit<PaperPositionsFeedState, 'refresh'>>({
    data:      null,
    loading:   true,
    error:     null,
    updatedAt: null,
  });

  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/paper/positions', { cache: 'no-store' });
      if (!r.ok) {
        setState((s) => ({ ...s, loading: false, error: `HTTP ${r.status}` }));
        return;
      }
      const json = await r.json();
      if (json?.ok) {
        const { ok: _ok, correlationId: _cid, ...data } = json;
        setState({ data: data as PaperPositionApiResponse, loading: false, error: null, updatedAt: new Date() });
      }
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error:   err instanceof Error ? err.message : 'Network error',
      }));
    }
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetch_]);

  return { ...state, refresh: fetch_ };
}
