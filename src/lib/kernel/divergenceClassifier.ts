import { prisma }       from '@/lib/db';
import { logger }       from '@/core/logger';
import type { DivergenceReport } from './divergenceMonitor';

const log = logger.withContext({ service: 'divergence-classifier' });

export type DivergenceSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export function classifyDivergence(report: DivergenceReport): DivergenceSeverity {
  // CRITICAL: one system believes trade is active, the other does not
  if (report.activeTradesDiverged) return 'CRITICAL';

  // CRITICAL: lifecycle mode mismatch while either side has an active trade
  if (report.lifecycleModeDiverged && (report.kernelTradeActive || report.systemTradeActive)) {
    return 'CRITICAL';
  }

  // WARNING: lifecycle mode mismatch with no active trade (timing or state lag)
  if (report.lifecycleModeDiverged) return 'WARNING';

  // INFO: minor field differences that don't affect trade safety
  return 'INFO';
}

export async function persistDivergence(
  severity: DivergenceSeverity,
  report: DivergenceReport,
  correlationId: string,
  tradePhase?: string,
  tradeStatus?: string,
): Promise<void> {
  try {
    await prisma.kernelDivergenceLog.create({
      data: {
        severity,
        correlationId,
        kernelMode:        report.kernelLifecycleMode,
        systemMode:        report.systemLifecycleMode,
        kernelTradePhase:  tradePhase  ?? null,
        systemTradeStatus: tradeStatus ?? null,
        kernelTradeActive: report.kernelTradeActive,
        systemTradeActive: report.systemTradeActive,
        detail: {
          lifecycleModeDiverged: report.lifecycleModeDiverged,
          activeTradesDiverged:  report.activeTradesDiverged,
          checkedAt:             report.checkedAt,
        },
      },
    });
  } catch (err) {
    log.error('failed to persist divergence log', { err: String(err) });
  }
}
