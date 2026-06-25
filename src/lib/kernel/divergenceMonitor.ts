import { prisma }                  from '@/lib/db';
import { logger }                  from '@/core/logger';
import type { CoreStateKernel }    from '@/kernel/KernelAPI';
import type { DashboardState }     from '@/types';
import { classifyDivergence, persistDivergence } from './divergenceClassifier';
import { recordDivergence }        from './metricsCollector';

const log = logger.withContext({ service: 'divergence-monitor' });

const ACTIVE_TRADE_PHASES = new Set([
  'POSITION_OPEN', 'TP1_REACHED', 'TP2_REACHED', 'TP3_REACHED',
]);

const ACTIVE_TRADE_STATUSES = new Set([
  'ACTIVE', 'ENTERED', 'TP1_HIT', 'TP2_HIT', 'TP3_HIT',
]);

export interface DivergenceReport {
  diverged:              boolean;
  lifecycleModeDiverged: boolean;
  activeTradesDiverged:  boolean;
  kernelLifecycleMode:   string;
  systemLifecycleMode:   string;
  kernelTradeActive:     boolean;
  systemTradeActive:     boolean;
  checkedAt:             string;
}

export async function checkDivergence(
  kernel: CoreStateKernel,
  correlationId: string,
): Promise<DivergenceReport | null> {
  if (!kernel.isInitialized()) return null;

  let systemState: DashboardState | null = null;
  try {
    const row = await prisma.systemState.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (row) systemState = row.state as unknown as DashboardState;
  } catch {
    return null;
  }
  if (!systemState) return null;

  const kLifecycle   = kernel.readState('lifecycle');
  const kTrade       = kernel.readState('trade');
  const kernelMode   = kLifecycle.mode as string;
  const systemMode   = systemState.mode as string;
  const kernelActive = ACTIVE_TRADE_PHASES.has(kTrade.phase);
  const systemActive = ACTIVE_TRADE_STATUSES.has(systemState.trade?.status ?? '');

  const lifecycleModeDiverged = kernelMode !== systemMode;
  const activeTradesDiverged  = kernelActive !== systemActive;
  const diverged = lifecycleModeDiverged || activeTradesDiverged;

  const report: DivergenceReport = {
    diverged,
    lifecycleModeDiverged,
    activeTradesDiverged,
    kernelLifecycleMode: kernelMode,
    systemLifecycleMode: systemMode,
    kernelTradeActive:   kernelActive,
    systemTradeActive:   systemActive,
    checkedAt:           new Date().toISOString(),
  };

  if (diverged) {
    const severity = classifyDivergence(report);
    log.warn('state divergence detected', {
      correlationId, severity, ...report,
    });

    // Persist to log and accumulate metrics — both fire-and-forget
    void persistDivergence(
      severity, report, correlationId,
      kTrade.phase, systemState.trade?.status,
    );
    void recordDivergence(severity);
  }

  return report;
}
