'use client';

import { useEffect, useCallback } from 'react';
import { useTradeStore } from '@/store';
import type { DashboardState } from '@/types';

const STATE_INTERVAL_MS = 10_000; // 10 seconds

export function useLiveFeed() {
  const setState = useTradeStore((s) => s.setState);

  const fetchState = useCallback(async () => {
    try {
      const r = await fetch('/api/state', { cache: 'no-store' });
      if (!r.ok) return;
      const data: DashboardState = await r.json();
      if (data && typeof data.price === 'number') {
        setState(data);
      }
    } catch {
      // Network or parse error — silent, retry on next interval
    }
  }, [setState]);

  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, STATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchState]);
}
