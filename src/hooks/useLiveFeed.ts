'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTradeStore } from '@/store';

const PRICE_INTERVAL_MS    = 3_000;        //  3 seconds
const ANALYSIS_INTERVAL_MS = 15 * 60_000;  // 15 minutes

export function useLiveFeed() {
  const setPrice      = useTradeStore((s) => s.setPrice);
  const applyAnalysis = useTradeStore((s) => s.applyAnalysis);

  const fetchPrice = useCallback(async () => {
    try {
      const r = await fetch('/api/price');
      if (!r.ok) return;
      const data = await r.json();
      if (typeof data.price === 'number') setPrice(data.price);
    } catch {
      // TradingView not running — silent
    }
  }, [setPrice]);

  const fetchAnalysis = useCallback(async () => {
    try {
      const r = await fetch('/api/analysis');
      if (!r.ok) return;
      const data = await r.json();
      if (data.error || !data.price) return;
      applyAnalysis({
        price:   data.price,
        regime:  data.regime,
        htfBias: data.htfBias,
        setupA:  data.setupA,
        setupB:  data.setupB,
      });
    } catch {
      // silent
    }
  }, [applyAnalysis]);

  // Price tick
  useEffect(() => {
    fetchPrice();
    const id = setInterval(fetchPrice, PRICE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchPrice]);

  // Analysis refresh (also fires immediately on mount)
  useEffect(() => {
    fetchAnalysis();
    const id = setInterval(fetchAnalysis, ANALYSIS_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchAnalysis]);
}
