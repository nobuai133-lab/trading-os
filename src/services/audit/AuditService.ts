import { prisma }  from '@/lib/db';
import { logger }   from '@/core/logger';
import { generateCorrelationId } from '@/core/correlationId';

const log = logger.withContext({ service: 'audit' });

export type AuditAction =
  | 'SIGNAL_RECEIVED'
  | 'SIGNAL_REJECTED'
  | 'TRADE_OPENED'
  | 'TRADE_CLOSED'
  | 'RISK_REJECTED'
  | 'MEMORY_BLOCKED'
  | 'PROVIDER_FAILOVER'
  | 'HEALTH_CHECK'
  | 'CONFIG_CHANGE';

export interface AuditEntry {
  action:        AuditAction;
  actor:         string;
  resource?:     string;
  correlationId: string;
  detail?:       Record<string, unknown>;
}

export class AuditService {
  async log(
    entry: AuditEntry,
    correlationId = entry.correlationId ?? generateCorrelationId(),
  ): Promise<void> {
    try {
      // AuditLog model is added in R-10 (Prisma migration).
      // Until that migration runs, this is a no-op with a warning log.
      if (!('auditLog' in prisma)) {
        log.warn('auditLog model not yet migrated â€” skipping DB write', { correlationId, action: entry.action });
        return;
      }

      await (prisma as any).auditLog.create({
        data: {
          action:        entry.action,
          actor:         entry.actor,
          resource:      entry.resource ?? null,
          correlationId,
          detail:        entry.detail ?? {},
        },
      });
    } catch (err) {
      // Audit failure must never crash the caller
      log.error('audit write failed', { correlationId, err: String(err) });
    }
  }
}

export const auditService = new AuditService();

