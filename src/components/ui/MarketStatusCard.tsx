'use client';

import React, { useEffect, useState } from 'react';
import GlassCard from './GlassCard';
import type { ProviderHealth } from '@/lib/marketData/types';

interface MarketStatus {
  activeProvider: string;
  providers:      ProviderHealth[];
  failoverLog:    { from: string; to: string; reason: string; ts: string }[];
  ts:             string;
}

function ScoreBar({ value }: { value: number }) {
  const pct   = Math.round(value * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-white/50">{pct}%</span>
    </div>
  );
}

function ProviderRow({ p, active }: { p: ProviderHealth; active: boolean }) {
  const status = p.available
    ? active ? 'ACTIVE' : 'STANDBY'
    : 'OFFLINE';
  const statusColor =
    status === 'ACTIVE'  ? 'text-emerald-400' :
    status === 'STANDBY' ? 'text-blue-400'    :
    'text-red-400/70';

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${statusColor}`}>
          {status}
        </span>
        <span className="text-sm text-white/80 font-mono truncate">{p.provider}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <ScoreBar value={p.overallScore} />
        {p.latency > 0 && (
          <span className="text-xs text-white/40 w-14 text-right">{Math.round(p.latency)}ms</span>
        )}
      </div>
    </div>
  );
}

export default function MarketStatusCard() {
  const [data, setData]       = useState<MarketStatus | null>(null);
  const [error, setError]     = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetch_() {
      try {
        const res  = await fetch('/api/v1/health/providers', { cache: 'no-store' });
        const json = await res.json() as MarketStatus;
        if (active) { setData(json); setError(false); }
      } catch {
        if (active) setError(true);
      }
    }

    void fetch_();
    const id = setInterval(() => void fetch_(), 30_000);
    return () => { active = false; clearInterval(id); };
  }, []);

  if (!data) {
    return (
      <GlassCard className="animate-pulse">
        <div className="h-4 w-32 rounded bg-white/10" />
      </GlassCard>
    );
  }

  const activeProvider = data.providers.find((p) => p.provider === data.activeProvider);

  return (
    <GlassCard>
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${error ? 'bg-red-500' : 'bg-emerald-500'}`} />
          <span className="text-xs font-semibold uppercase tracking-widest text-white/60">
            Market Data
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-white/80">{data.activeProvider}</span>
          {activeProvider && <ScoreBar value={activeProvider.overallScore} />}
          <span className="text-white/30 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-3">
          {data.providers.map((p) => (
            <ProviderRow key={p.provider} p={p} active={p.provider === data.activeProvider} />
          ))}

          {data.failoverLog.length > 0 && (
            <div className="mt-3 pt-2 border-t border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Recent Failovers</p>
              {data.failoverLog.slice(-3).reverse().map((e, i) => (
                <div key={i} className="text-xs text-white/50 py-0.5">
                  {e.from} → {e.to} · <span className="text-white/30">{e.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
