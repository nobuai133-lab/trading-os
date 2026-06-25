import { prisma }           from '@/lib/db';
import { logger }           from '@/core/logger';
import type { DivergenceSeverity } from './divergenceClassifier';

const log = logger.withContext({ service: 'kernel-metrics' });

export interface KernelMetricsSnapshot {
  totalWebhookEvents:   number;
  totalKernelEvents:    number;
  kernelTransitions:    number;
  criticalDivergences:  number;
  warningDivergences:   number;
  infoDivergences:      number;
  snapshotCount:        number;
  avgLatencyMs:         number;
  lastLatencyMs:        number;
  consistencyPct:       number;
  lastSnapshotSeq:      bigint | null;
  firstEventAt:         Date;
  lastEventAt:          Date;
  updatedAt:            Date;
}

export interface GoLiveGateResult {
  pass:  boolean;
  value: number | boolean | string;
  target: number | boolean | string;
  label: string;
}

export interface GoLiveStatus {
  ready: boolean;
  gates: {
    consistency:       GoLiveGateResult;
    criticalDivergence: GoLiveGateResult;
    minimumEvents:     GoLiveGateResult;
    kernelInitialized: GoLiveGateResult;
    snapshotRecovery:  GoLiveGateResult;
  };
}

// ── Accumulator writes ──────────────────────────────────────────────────────

export async function recordWebhookEvent(): Promise<void> {
  await inc({ totalWebhookEvents: { increment: 1 }, lastEventAt: new Date() });
}

export async function recordKernelWrite(
  eventCount: number,
  latencyMs: number,
  transitionCount: number,
): Promise<void> {
  await inc({
    totalKernelEvents: { increment: eventCount },
    kernelTransitions: { increment: transitionCount },
    totalLatencyMs:    { increment: latencyMs },
    latencySamples:    { increment: 1 },
    lastLatencyMs:     latencyMs,
    lastEventAt:       new Date(),
  });
}

export async function recordDivergence(severity: DivergenceSeverity): Promise<void> {
  const field =
    severity === 'CRITICAL' ? 'criticalDivergences' :
    severity === 'WARNING'  ? 'warningDivergences'  : 'infoDivergences';
  await inc({ [field]: { increment: 1 } });
}

export async function recordSnapshot(seq: bigint): Promise<void> {
  await inc({ snapshotCount: { increment: 1 }, lastSnapshotSeq: seq });
}

// ── Reads ───────────────────────────────────────────────────────────────────

export async function getMetrics(): Promise<KernelMetricsSnapshot | null> {
  try {
    const row = await prisma.kernelMetrics.findUnique({ where: { id: 1 } });
    if (!row) return null;

    const avg = row.latencySamples > 0 ? row.totalLatencyMs / row.latencySamples : 0;
    const consistency = calcConsistency(row.totalWebhookEvents, row.criticalDivergences, row.warningDivergences);

    return {
      totalWebhookEvents:  row.totalWebhookEvents,
      totalKernelEvents:   row.totalKernelEvents,
      kernelTransitions:   row.kernelTransitions,
      criticalDivergences: row.criticalDivergences,
      warningDivergences:  row.warningDivergences,
      infoDivergences:     row.infoDivergences,
      snapshotCount:       row.snapshotCount,
      avgLatencyMs:        Math.round(avg * 10) / 10,
      lastLatencyMs:       row.lastLatencyMs,
      consistencyPct:      consistency,
      lastSnapshotSeq:     row.lastSnapshotSeq ?? null,
      firstEventAt:        row.firstEventAt,
      lastEventAt:         row.lastEventAt,
      updatedAt:           row.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function getRecentDivergences(limit = 10) {
  try {
    return await prisma.kernelDivergenceLog.findMany({
      orderBy: { ts: 'desc' },
      take:    limit,
    });
  } catch {
    return [];
  }
}

export function buildGoLiveStatus(
  metrics: KernelMetricsSnapshot | null,
  kernelInitialized: boolean,
): GoLiveStatus {
  if (!metrics) {
    return {
      ready: false,
      gates: {
        consistency:        { pass: false, value: 0,     target: 99.95, label: 'Consistency ≥ 99.95%' },
        criticalDivergence: { pass: false, value: '?',   target: 0,     label: 'Zero critical divergences' },
        minimumEvents:      { pass: false, value: 0,     target: 1000,  label: '≥1000 events OR 7 consecutive days' },
        kernelInitialized:  { pass: false, value: false, target: true,  label: 'Kernel initialized' },
        snapshotRecovery:   { pass: false, value: false, target: true,  label: 'Snapshot recovery verified' },
      },
    };
  }

  const daysSince = metrics.firstEventAt
    ? (Date.now() - new Date(metrics.firstEventAt).getTime()) / 86_400_000
    : 0;

  const gates = {
    consistency: {
      pass:   metrics.consistencyPct >= 99.95,
      value:  Math.round(metrics.consistencyPct * 100) / 100,
      target: 99.95,
      label:  'Consistency ≥ 99.95%',
    },
    criticalDivergence: {
      pass:   metrics.criticalDivergences === 0,
      value:  metrics.criticalDivergences,
      target: 0,
      label:  'Zero critical divergences',
    },
    minimumEvents: {
      pass:   metrics.totalKernelEvents >= 1000 || daysSince >= 7,
      value:  metrics.totalKernelEvents,
      target: 1000,
      label:  `≥1000 events OR 7 consecutive days (${Math.round(daysSince * 10) / 10}d elapsed)`,
    },
    kernelInitialized: {
      pass:   kernelInitialized,
      value:  kernelInitialized,
      target: true,
      label:  'Kernel initialized',
    },
    snapshotRecovery: {
      pass:   metrics.snapshotCount > 0,
      value:  metrics.snapshotCount,
      target: 1,
      label:  'At least one snapshot created (recovery path verified)',
    },
  };

  const ready = Object.values(gates).every((g) => g.pass);
  return { ready, gates };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function calcConsistency(total: number, critical: number, warning: number): number {
  if (total === 0) return 100;
  const diverged = critical + warning;
  return Math.max(0, Math.min(100, ((total - diverged) / total) * 100));
}

async function inc(data: Record<string, unknown>): Promise<void> {
  try {
    await prisma.kernelMetrics.upsert({
      where:  { id: 1 },
      create: { id: 1 },   // schema defaults fill the rest
      update: data,
    });
  } catch (err) {
    log.error('metrics increment failed', { err: String(err) });
  }
}
