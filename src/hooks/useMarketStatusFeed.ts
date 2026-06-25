'use client';

import { useState, useEffect, useRef } from 'react';
import { useTradeStore } from '@/store';
import type { MarketDataBadge } from '@/types';

export interface MarketStatus {
  latestPrice:          number;
  provider:             string;
  badge:                MarketDataBadge;
  candleAgeSeconds:     number | null;
  analysisAgeSeconds:   number | null;
  isTickerFresh:        boolean;
  isCandleFresh:        boolean;
  isAnalysisFresh:      boolean;
  latestPriceTimestamp: string;
  latestClosedCandleTs: string | null;
  warning?:             string;
  lastFetchedAt:        string;
  error:                boolean;
  priceBasis?:          'PERP' | 'SPOT';
  basisWarning?:        string;
  fallbackActive?:      boolean;
}

const POLL_MS = 2_000;

export const MARKET_STATUS_FALLBACK: MarketStatus = {
  latestPrice:          0,
  provider:             '',
  badge:                'ERROR',
  candleAgeSeconds:     null,
  analysisAgeSeconds:   null,
  isTickerFresh:        false,
  isCandleFresh:        false,
  isAnalysisFresh:      false,
  latestPriceTimestamp: '',
  latestClosedCandleTs: null,
  lastFetchedAt:        '',
  error:                true,
};

export function useMarketStatusFeed(): MarketStatus {
  const [status, setStatus] = useState<MarketStatus>(MARKET_STATUS_FALLBACK);
  const setPrice   = useTradeStore((s) => s.setPrice);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function poll() {
      try {
        const r = await fetch('/api/v1/market/status', {
          cache:   'no-store',
          headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' },
        });
        if (!r.ok || !mountedRef.current) return;
        const d = await r.json() as Record<string, unknown>;
        if (!mountedRef.current) return;

        const next: MarketStatus = {
          latestPrice:          typeof d.latestPrice === 'number'  ? d.latestPrice  : 0,
          provider:             typeof d.provider    === 'string'  ? d.provider     : '',
          badge:                (d.badge as MarketDataBadge)       ?? 'ERROR',
          candleAgeSeconds:     typeof d.candleAgeSeconds  === 'number' ? d.candleAgeSeconds  : null,
          analysisAgeSeconds:   typeof d.analysisAgeSeconds === 'number' ? d.analysisAgeSeconds : null,
          isTickerFresh:        Boolean(d.isTickerFresh),
          isCandleFresh:        Boolean(d.isCandleFresh),
          isAnalysisFresh:      Boolean(d.isAnalysisFresh),
          latestPriceTimestamp: typeof d.latestPriceTimestamp === 'string' ? d.latestPriceTimestamp : '',
          latestClosedCandleTs: typeof d.latestClosedCandleTs === 'string' ? d.latestClosedCandleTs : null,
          warning:              typeof d.warning      === 'string' ? d.warning      : undefined,
          lastFetchedAt:        new Date().toISOString(),
          error:                false,
          priceBasis:           d.priceBasis === 'PERP' || d.priceBasis === 'SPOT' ? d.priceBasis : undefined,
          basisWarning:         typeof d.basisWarning === 'string' ? d.basisWarning : undefined,
          fallbackActive:       Boolean(d.fallbackActive),
        };

        setStatus(next);
        // Also sync price into store so other components reading state.price stay current
        if (next.latestPrice > 0) setPrice(next.latestPrice);
      } catch {
        // Network failure — retain last known good status, never crash the dashboard
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [setPrice]);

  return status;
}
