'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MemorySummary, SimilarityResult, ExperienceLesson, SetupFingerprintData } from '@/types';

const POLL_INTERVAL_MS = 30_000; // 30s — memory changes only on trade close

export interface MemoryFeedState {
  summary:      MemorySummary | null;
  fingerprint:  SetupFingerprintData | null;
  similarity:   SimilarityResult | null;
  topLessons:   ExperienceLesson[];
  loading:      boolean;
  error:        string | null;
  updatedAt:    Date | null;
}

export function useMemoryFeed(): MemoryFeedState {
  const [state, setState] = useState<MemoryFeedState>({
    summary:     null,
    fingerprint: null,
    similarity:  null,
    topLessons:  [],
    loading:     true,
    error:       null,
    updatedAt:   null,
  });

  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/memory', { cache: 'no-store' });
      if (!r.ok) {
        setState((s) => ({ ...s, loading: false, error: `HTTP ${r.status}` }));
        return;
      }
      const data = await r.json();
      if (data?.ok) {
        setState({
          summary:    data.summary     ?? null,
          fingerprint: data.fingerprint ?? null,
          similarity:  data.similarity  ?? null,
          topLessons:  data.experience?.lessons ?? [],
          loading:     false,
          error:       null,
          updatedAt:   new Date(),
        });
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
