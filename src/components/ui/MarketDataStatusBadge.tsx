'use client';

import type { MarketDataBadge } from '@/types';

const BADGE_STYLES: Record<MarketDataBadge, { color: string; bg: string; border: string; label: string }> = {
  LIVE:         { color: '#00E5A8', bg: 'rgba(0,229,168,0.10)',   border: 'rgba(0,229,168,0.25)',   label: 'LIVE' },
  CANDLE_CLOSED:{ color: '#38BDF8', bg: 'rgba(56,189,248,0.10)',  border: 'rgba(56,189,248,0.25)',  label: 'CANDLE CLOSED' },
  STALE:        { color: '#FBBF24', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.25)',  label: 'STALE' },
  FALLBACK:     { color: '#A78BFA', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.25)', label: 'FALLBACK' },
  MOCK:         { color: '#64748B', bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.25)', label: 'MOCK' },
  ERROR:        { color: '#FF3B5C', bg: 'rgba(255,59,92,0.10)',   border: 'rgba(255,59,92,0.25)',   label: 'ERROR' },
};

interface Props {
  badge:               MarketDataBadge;
  provider?:           string;
  warning?:            string;
  analysisAgeSeconds?: number;
}

export default function MarketDataStatusBadge({ badge, provider, warning, analysisAgeSeconds }: Props) {
  const s = BADGE_STYLES[badge] ?? BADGE_STYLES.ERROR;

  const ageLabel =
    analysisAgeSeconds !== undefined && analysisAgeSeconds > 0
      ? ` · ${analysisAgeSeconds < 60
          ? `${analysisAgeSeconds}s`
          : `${Math.round(analysisAgeSeconds / 60)}m`}`
      : '';

  const providerLabel =
    provider && provider !== 'db-fallback' && badge === 'LIVE'
      ? provider
      : undefined;

  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-[8px] font-bold px-1.5 py-0.5 rounded-chip tracking-wider uppercase"
        style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
        title={warning ?? `${s.label}${ageLabel}`}
      >
        {s.label}{ageLabel}
      </span>
      {providerLabel && (
        <span className="text-[8px] text-muted2 truncate max-w-[64px]">{providerLabel}</span>
      )}
    </div>
  );
}
