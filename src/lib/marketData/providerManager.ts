import type { IMarketDataProvider } from './providers/IMarketDataProvider';
import type { ProviderHealth, FailoverEvent } from './types';
import { logger } from '../logger';

const HEALTH_CHECK_INTERVAL_MS = 60_000;

export class ProviderManager {
  private providers:    IMarketDataProvider[];
  private activeIndex:  number = 0;
  private failoverLog:  FailoverEvent[] = [];
  private checkTimer?:  ReturnType<typeof setInterval>;

  constructor(providers: IMarketDataProvider[]) {
    // Sort ascending by priority; lowest number = highest priority
    this.providers = [...providers].sort((a, b) => a.priority - b.priority);
    this.activeIndex = this.pickBestIndex();
  }

  // ── provider selection ───────────────────────────────────────────────────────

  getActive(): IMarketDataProvider {
    return this.providers[this.activeIndex];
  }

  getAll(): IMarketDataProvider[] {
    return this.providers;
  }

  getAvailable(): IMarketDataProvider[] {
    return this.providers.filter((p) => p.isAvailable());
  }

  // ── health + failover ────────────────────────────────────────────────────────

  getAllHealth(): ProviderHealth[] {
    return this.providers.map((p) => p.getHealth());
  }

  getFailoverLog(): FailoverEvent[] {
    return [...this.failoverLog];
  }

  private pickBestIndex(): number {
    const available = this.providers.filter((p) => p.isAvailable());
    if (available.length === 0) return this.providers.length - 1; // last resort

    // Among available providers, pick highest score (lowest priority number wins ties)
    const best = available.reduce((prev, curr) =>
      curr.getHealth().overallScore > prev.getHealth().overallScore ? curr : prev
    );
    return this.providers.indexOf(best);
  }

  failover(reason: string): IMarketDataProvider | null {
    const current  = this.providers[this.activeIndex];
    const newIndex = this.pickBestIndex();

    if (newIndex === this.activeIndex) return null; // no better option

    const next = this.providers[newIndex];
    const event: FailoverEvent = {
      from:   current.name,
      to:     next.name,
      reason,
      ts:     new Date().toISOString(),
    };

    this.failoverLog.push(event);
    if (this.failoverLog.length > 50) this.failoverLog.shift();

    logger.warn('provider.failover', { from: event.from, to: event.to, reason });
    this.activeIndex = newIndex;
    return next;
  }

  // ── periodic health checks ───────────────────────────────────────────────────

  startHealthChecks(symbol = 'BTCUSDT'): void {
    if (this.checkTimer) return;
    this.checkTimer = setInterval(() => void this.runHealthCheck(symbol), HEALTH_CHECK_INTERVAL_MS);
  }

  stopHealthChecks(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
  }

  private async runHealthCheck(symbol: string): Promise<void> {
    for (const provider of this.providers) {
      try {
        await provider.fetchTicker(symbol);
      } catch {
        // recordFailure called inside provider.timed()
      }
    }

    const newBest = this.pickBestIndex();
    if (newBest !== this.activeIndex) {
      this.failover('health-check');
    }
  }
}
