import { prisma }            from '@/lib/db';
import { marketDataEngine }  from '@/lib/marketData/engine';
import { logger }            from '@/core/logger';
import type { ProviderHealth } from '@/lib/marketData/types';

const log = logger.withContext({ service: 'health' });

export interface SystemHealthReport {
  status:    'ok' | 'degraded' | 'down';
  database:  { ok: boolean; latencyMs: number; error?: string };
  market:    { activeProvider: string; providers: ProviderHealth[] };
  uptime:    number;
  checkedAt: string;
}

export class HealthService {
  private readonly startTime = Date.now();

  async check(): Promise<SystemHealthReport> {
    const [db, market] = await Promise.all([
      this.checkDatabase(),
      this.checkMarket(),
    ]);

    const status: SystemHealthReport['status'] =
      !db.ok        ? 'down'     :
      market.providers.every((p) => !p.available) ? 'degraded' :
      'ok';

    return {
      status,
      database:  db,
      market,
      uptime:    Math.floor((Date.now() - this.startTime) / 1000),
      checkedAt: new Date().toISOString(),
    };
  }

  async isReady(): Promise<boolean> {
    try {
      const report = await this.check();
      return report.status !== 'down';
    } catch {
      return false;
    }
  }

  private async checkDatabase(): Promise<SystemHealthReport['database']> {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      log.error('db health check failed', { err: String(err) });
      return { ok: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }

  private checkMarket(): SystemHealthReport['market'] {
    return {
      activeProvider: marketDataEngine.getActiveProvider(),
      providers:      marketDataEngine.getProviderHealth(),
    };
  }
}

export const healthService = new HealthService();

