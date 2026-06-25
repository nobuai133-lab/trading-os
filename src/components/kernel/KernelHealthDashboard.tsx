'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GateResult { pass: boolean; value: number | boolean | string; target: number | boolean | string; label: string; }
interface GoLiveGates { consistency: GateResult; criticalDivergence: GateResult; minimumEvents: GateResult; kernelInitialized: GateResult; snapshotRecovery: GateResult; }
interface Metrics { totalWebhookEvents: number; totalKernelEvents: number; kernelTransitions: number; criticalDivergences: number; warningDivergences: number; infoDivergences: number; snapshotCount: number; avgLatencyMs: number; lastLatencyMs: number; consistencyPct: number; lastSnapshotSeq: string | null; firstEventAt: string | null; lastEventAt: string | null; updatedAt: string; }
interface DivergenceEntry { id: number; ts: string; severity: string; correlationId: string; kernelMode: string; systemMode: string; kernelTradePhase: string | null; systemTradeStatus: string | null; }
interface HealthData { ok: boolean; authority: string; shadow: boolean; status: 'healthy' | 'degraded' | 'critical'; metrics: Metrics | null; goLive: { ready: boolean; gates: GoLiveGates }; kernelSummary: { eventCount: number; tradePhase: string; lifecycleMode: string; lastEventId: string | null } | null; recentDivergences: DivergenceEntry[]; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number, d = 1): string => n.toFixed(d);
const pct = (n: number): string => `${fmt(n, 2)}%`;
const ms  = (n: number): string => `${fmt(n, 1)}ms`;

function statusColor(status: string): string {
  if (status === 'healthy')  return 'text-green-400';
  if (status === 'degraded') return 'text-yellow-400';
  return 'text-red-400';
}

function consistencyColor(pctVal: number): string {
  if (pctVal >= 99.95) return 'text-green-400';
  if (pctVal >= 99.0)  return 'text-yellow-400';
  return 'text-red-400';
}

function severityBadge(s: string): string {
  if (s === 'CRITICAL') return 'bg-red-900 text-red-300 border border-red-700';
  if (s === 'WARNING')  return 'bg-yellow-900 text-yellow-300 border border-yellow-700';
  return 'bg-gray-700 text-gray-300';
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function KernelHealthDashboard() {
  const [data, setData]       = useState<HealthData | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<string>('—');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/kernel/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as HealthData;
      setData(json);
      setError(null);
      setLastFetch(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const m  = data?.metrics;
  const gl = data?.goLive;
  const ks = data?.kernelSummary;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-mono text-sm">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Kernel Health — Shadow Mode</h1>
          <p className="text-gray-400 mt-1">
            Current authority: <span className="text-blue-400 font-bold">SystemState</span>
            &nbsp;·&nbsp;Kernel: observation-only
          </p>
        </div>
        <div className="text-right text-gray-500">
          <div className={`text-lg font-bold ${statusColor(data?.status ?? 'healthy')}`}>
            {data?.status?.toUpperCase() ?? '—'}
          </div>
          <div className="text-xs mt-1">refreshed {lastFetch}</div>
          <button onClick={() => void refresh()} className="mt-1 text-xs text-blue-400 hover:text-blue-200">↻ refresh</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 rounded p-3 mb-4 text-red-300">
          Error: {error}
        </div>
      )}

      {/* Consistency Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 col-span-1 flex flex-col items-center justify-center">
          <div className="text-gray-400 text-xs mb-1 uppercase tracking-widest">Consistency</div>
          <div className={`text-5xl font-bold ${consistencyColor(m?.consistencyPct ?? 100)}`}>
            {m ? pct(m.consistencyPct) : '—'}
          </div>
          <div className="text-gray-500 text-xs mt-2">target: ≥ 99.95%</div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 col-span-2 grid grid-cols-2 gap-3">
          <Stat label="Webhook Events"    value={m?.totalWebhookEvents ?? '—'} />
          <Stat label="Kernel Events"     value={m?.totalKernelEvents  ?? '—'} />
          <Stat label="Transitions"       value={m?.kernelTransitions  ?? '—'} />
          <Stat label="Snapshots"         value={m?.snapshotCount      ?? '—'} />
          <Stat label="Avg Latency"       value={m ? ms(m.avgLatencyMs) : '—'} />
          <Stat label="Last Latency"      value={m ? ms(m.lastLatencyMs) : '—'} />
        </div>
      </div>

      {/* Divergences */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <DivCard label="CRITICAL" count={m?.criticalDivergences ?? 0} color="red" />
        <DivCard label="WARNING"  count={m?.warningDivergences  ?? 0} color="yellow" />
        <DivCard label="INFO"     count={m?.infoDivergences     ?? 0} color="gray" />
      </div>

      {/* Go-Live Gate */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-white">Go-Live Gate (Stage 3)</h2>
          <span className={`px-3 py-1 rounded text-xs font-bold ${gl?.ready ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'}`}>
            {gl?.ready ? '✓ READY' : '✗ NOT READY'}
          </span>
        </div>
        <div className="space-y-2">
          {gl && Object.entries(gl.gates).map(([key, gate]) => (
            <div key={key} className="flex items-center gap-3">
              <span className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${gate.pass ? 'bg-green-700 text-green-100' : 'bg-gray-700 text-gray-400'}`}>
                {gate.pass ? '✓' : '○'}
              </span>
              <span className={`flex-1 ${gate.pass ? 'text-gray-300' : 'text-gray-500'}`}>{gate.label}</span>
              <span className="text-gray-600 text-xs">{String(gate.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Kernel Summary + Snapshot */}
      {ks && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="text-gray-400 text-xs uppercase tracking-widest mb-2">Kernel State</div>
            <div className="space-y-1">
              <Row k="Trade Phase"    v={ks.tradePhase} />
              <Row k="Lifecycle Mode" v={ks.lifecycleMode} />
              <Row k="Event Count"    v={String(ks.eventCount)} />
              <Row k="Last Event ID"  v={ks.lastEventId ?? '—'} />
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="text-gray-400 text-xs uppercase tracking-widest mb-2">Snapshot Status</div>
            <div className="space-y-1">
              <Row k="Count"          v={String(m?.snapshotCount ?? 0)} />
              <Row k="Last Seq"       v={m?.lastSnapshotSeq ?? '—'} />
              <Row k="First Event"    v={m?.firstEventAt ? new Date(m.firstEventAt).toLocaleDateString() : '—'} />
              <Row k="Last Event"     v={m?.lastEventAt   ? new Date(m.lastEventAt).toLocaleTimeString() : '—'} />
            </div>
          </div>
        </div>
      )}

      {/* Recent Divergences */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-5">
        <h2 className="font-bold text-white mb-3">Recent Divergences</h2>
        {data?.recentDivergences.length === 0 ? (
          <div className="text-green-400 text-xs">No divergences recorded ✓</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-1 pr-3">Time</th>
                  <th className="text-left py-1 pr-3">Severity</th>
                  <th className="text-left py-1 pr-3">Kernel Mode</th>
                  <th className="text-left py-1 pr-3">System Mode</th>
                  <th className="text-left py-1 pr-3">Trade Phase</th>
                  <th className="text-left py-1">CID</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentDivergences.map((d) => (
                  <tr key={d.id} className="border-b border-gray-900 hover:bg-gray-800">
                    <td className="py-1 pr-3 text-gray-400">{new Date(d.ts).toLocaleTimeString()}</td>
                    <td className="py-1 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${severityBadge(d.severity)}`}>
                        {d.severity}
                      </span>
                    </td>
                    <td className="py-1 pr-3 text-blue-300">{d.kernelMode}</td>
                    <td className="py-1 pr-3 text-yellow-300">{d.systemMode}</td>
                    <td className="py-1 pr-3 text-gray-300">{d.kernelTradePhase ?? '—'}</td>
                    <td className="py-1 text-gray-600 truncate max-w-24">{d.correlationId.slice(-8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-gray-500 text-xs">{label}</div>
      <div className="text-white font-bold">{value}</div>
    </div>
  );
}

function DivCard({ label, count, color }: { label: string; count: number; color: 'red' | 'yellow' | 'gray' }) {
  const styles: Record<string, string> = {
    red:    'bg-red-950 border-red-800 text-red-400',
    yellow: 'bg-yellow-950 border-yellow-800 text-yellow-400',
    gray:   'bg-gray-900 border-gray-700 text-gray-400',
  };
  return (
    <div className={`border rounded-lg p-4 text-center ${styles[color]}`}>
      <div className="text-3xl font-bold">{count}</div>
      <div className="text-xs mt-1 opacity-70">{label}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{k}</span>
      <span className="text-white">{v}</span>
    </div>
  );
}
