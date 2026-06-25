'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DecisionResult } from '@/types';

const POLL_INTERVAL_MS = 10_000;

export interface DecisionFeedState {
  decision:  DecisionResult | null;
  loading:   boolean;
  error:     string | null;
  updatedAt: Date | null;
}

export function useDecisionFeed(): DecisionFeedState {
  const [state, setState] = useState<DecisionFeedState>({
    decision:  null,
    loading:   true,
    error:     null,
    updatedAt: null,
  });

  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/decision', { cache: 'no-store' });
      if (!r.ok) {
        setState((s) => ({ ...s, loading: false, error: `HTTP ${r.status}` }));
        return;
      }
      const data = await r.json();
      if (data?.ok && data.decision) {
        setState({ decision: data.decision, loading: false, error: null, updatedAt: new Date() });
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

  return state;
}
