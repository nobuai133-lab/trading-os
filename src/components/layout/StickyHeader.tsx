'use client';

import { useState, useEffect, useRef } from 'react';
import type { DashboardState, Decision } from '@/types';
import { confColorClass } from '@/lib/utils';
import { useTradeStore } from '@/store';
import { SCENARIOS } from '@/data/scenarios';
import { useMarketStatusFeed } from '@/hooks/useMarketStatusFeed';
import MarketDataStatusBadge from '@/components/ui/MarketDataStatusBadge';

const DECISION_COLORS: Record<Decision, { text: string; bg: string; border: string }> = {
  LONG:       { text: '#00E5A8', bg: 'rgba(0,229,168,0.12)',   border: 'rgba(0,229,168,0.25)'  },
  SHORT:      { text: '#FF3B5C', bg: 'rgba(255,59,92,0.12)',   border: 'rgba(255,59,92,0.25)'  },
  WAIT:       { text: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)' },
  'NO TRADE': { text: '#64748B', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.25)'},
};

interface Props {
  state: DashboardState;
}

const SCENARIO_LABELS = [
  { key: 'setup',  label: 'Setup'       },
  { key: 'active', label: 'TP1 Hit'     },
  { key: 'tp3',    label: 'TP3'         },
  { key: 'sl',     label: 'SL Hit'      },
  { key: 'idle',   label: 'Idle'        },
  { key: 'stale',  label: 'Stale Range' },
];

export default function StickyHeader({ state }: Props) {
  const dc         = DECISION_COLORS[state.decision];
  const [devOpen, setDevOpen]   = useState(false);
  const [isLive,  setIsLive]    = useState(false);
  const setState   = useTradeStore((s) => s.setState);

  // Live tick price — polls /api/v1/market/status every 2s
  const marketStatus = useMarketStatusFeed();
  const displayPrice = marketStatus.latestPrice > 0 ? marketStatus.latestPrice : state.price;
  const prevPrice    = useRef<number>(displayPrice);

  // Flash live dot when tick price changes
  useEffect(() => {
    if (displayPrice !== prevPrice.current) {
      prevPrice.current = displayPrice;
      setIsLive(true);
      const t = setTimeout(() => setIsLive(false), 800);
      return () => clearTimeout(t);
    }
  }, [displayPrice]);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 gap-3"
      style={{
        background:           'rgba(7,10,15,0.90)',
        backdropFilter:       'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom:         '1px solid rgba(255,255,255,0.06)',
        paddingTop:           'calc(env(safe-area-inset-top, 0px))',
      }}
    >
      {/* Left: live dot + symbol + TF */}
      <div className="flex items-center gap-2 flex-1">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background:  isLive ? '#00E5A8' : '#334155',
            boxShadow:   isLive ? '0 0 6px rgba(0,229,168,0.7)' : 'none',
            transition:  'background 0.2s, box-shadow 0.2s',
          }}
        />
        <span className="text-[13px] font-bold text-text tracking-tight">{state.symbol}</span>
        <span className="text-muted2 text-[11px]">·</span>
        <span className="text-[11px] font-semibold text-muted">{state.timeframe}</span>
      </div>

      {/* Center: live tick price + market badge */}
      <div className="flex-1 flex flex-col items-center justify-center gap-0.5">
        <span
          className="text-[15px] font-bold tabular-nums tracking-tight"
          style={{
            color:      isLive ? '#00E5A8' : '#F8FAFC',
            transition: 'color 0.2s',
          }}
        >
          {displayPrice > 0 ? `$${displayPrice.toLocaleString()}` : '—'}
        </span>
        {!marketStatus.error && (
          <MarketDataStatusBadge
            badge={marketStatus.badge}
            provider={marketStatus.provider}
            warning={marketStatus.warning}
            analysisAgeSeconds={marketStatus.candleAgeSeconds ?? undefined}
            priceBasis={marketStatus.priceBasis}
            basisWarning={marketStatus.basisWarning}
          />
        )}
      </div>

      {/* Right: decision + confidence + dev toggle */}
      <div className="flex items-center gap-2 flex-1 justify-end">
        <span
          className="text-[10px] font-bold tracking-widest px-2 py-1 rounded-chip"
          style={{ color: dc.text, background: dc.bg, border: `1px solid ${dc.border}` }}
        >
          {state.decision}
        </span>
        <span className={`text-[12px] font-bold tabular-nums ${confColorClass(state.confidence)}`}>
          {state.confidence}%
        </span>

        {/* Dev scenario picker */}
        <div className="relative">
          <button
            onClick={() => setDevOpen(v => !v)}
            className="w-6 h-6 flex items-center justify-center rounded-full text-[11px]"
            style={{
              background: 'rgba(71,85,105,0.25)',
              border:     '1px solid rgba(71,85,105,0.35)',
              color:      '#475569',
              cursor:     'pointer',
            }}
            title="Dev scenarios"
          >
            ⚙
          </button>
          {devOpen && (
            <div
              className="absolute right-0 top-8 rounded-[10px] overflow-hidden z-50 flex flex-col"
              style={{
                background:   'rgba(15,20,30,0.97)',
                border:       '1px solid rgba(255,255,255,0.10)',
                backdropFilter: 'blur(20px)',
                minWidth:     '130px',
              }}
            >
              {SCENARIO_LABELS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setState(SCENARIOS[key]); setDevOpen(false); }}
                  className="text-left px-3 py-2 text-[11px] font-semibold transition-colors"
                  style={{
                    color:      '#94A3B8',
                    background: 'transparent',
                    border:     'none',
                    cursor:     'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
