'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RiskOfficeResult } from '@/types';

const POLL_INTERVAL_MS = 15_000; // 15s — risk state changes with every trade close

export interface RiskOfficeFeedState {
  result:    RiskOfficeResult | null;
  loading:   boolean;
  error:     string | null;
  updatedAt: Date | null;
}

export function useRiskOfficeFeed(): RiskOfficeFeedState {
  const [state, setState] = useState<RiskOfficeFeedState>({
    result:    null,
    loading:   true,
    error:     null,
    updatedAt: null,
  });

  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/risk', { cache: 'no-store' });
      if (!r.ok) {
        setState((s) => ({ ...s, loading: false, error: `HTTP ${r.status}` }));
        return;
      }
      const data = await r.json();
      if (data?.ok) {
        const { ok: _ok, correlationId: _cid, authority: _auth, ...result } = data;
        setState({ result, loading: false, error: null, updatedAt: new Date() });
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
