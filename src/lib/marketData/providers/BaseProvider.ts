import type { OHLCVBar, Ticker, OrderBook, FundingRate, OpenInterest, ProviderHealth, RateLimitStatus } from '../types';
import type { IMarketDataProvider } from './IMarketDataProvider';

const WINDOW_MS  = 60_000;
const MAX_CHECKS = 100;

export abstract class BaseProvider implements IMarketDataProvider {
  abstract readonly name:     string;
  abstract readonly priority: number;

  protected available    = true;
  protected latencySamples: number[] = [];
  protected successCount  = 0;
  protected failureCount  = 0;
  protected lastCheck     = new Date().toISOString();
  protected lastError?:    string;
  protected rateLimitUsed = 0;
  protected rateLimitMax  = 1200;
  protected rateLimitResetAt = Date.now() + WINDOW_MS;

  // ── health ───────────────────────────────────────────────────────────────────

  isAvailable(): boolean { return this.available; }

  getHealth(): ProviderHealth {
    const total = this.successCount + this.failureCount;
    const availability = total === 0 ? 1 : this.successCount / total;

    const latency = this.latencySamples.length
      ? this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length
      : 0;

    const rateLimit: RateLimitStatus = {
      used:    this.rateLimitUsed,
      limit:   this.rateLimitMax,
      resetAt: this.rateLimitResetAt,
      pct:     this.rateLimitMax > 0 ? this.rateLimitUsed / this.rateLimitMax : 0,
    };

    // freshness: inverse of latency penalty (capped at 1)
    const freshness   = Math.max(0, 1 - latency / 2000);
    const consistency = availability;
    const reliability = (availability * 0.4) + (freshness * 0.3) + (consistency * 0.3);
    const overallScore = reliability * (1 - rateLimit.pct * 0.5);

    return {
      provider:     this.name,
      available:    this.available,
      availability,
      latency,
      freshness,
      consistency,
      rateLimit,
      reliability,
      overallScore,
      lastCheck:    this.lastCheck,
      lastError:    this.lastError,
    };
  }

  // ── lifecycle helpers ────────────────────────────────────────────────────────

  protected recordSuccess(latencyMs: number): void {
    this.successCount++;
    this.lastCheck = new Date().toISOString();
    this.lastError = undefined;
    this.latencySamples.push(latencyMs);
    if (this.latencySamples.length > MAX_CHECKS) this.latencySamples.shift();
    this.available = true;
  }

  protected recordFailure(err: string): void {
    this.failureCount++;
    this.lastCheck = new Date().toISOString();
    this.lastError = err;
    if (this.failureCount > 3 && this.successCount === 0) this.available = false;
  }

  protected async timed<T>(fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.recordSuccess(Date.now() - start);
      return result;
    } catch (err) {
      this.recordFailure(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  // ── abstract methods ─────────────────────────────────────────────────────────

  abstract fetchOHLCV(symbol: string, timeframe: string, limit?: number): Promise<OHLCVBar[]>;
  abstract fetchTicker(symbol: string): Promise<Ticker>;
  abstract fetchOrderBook(symbol: string, depth?: number): Promise<OrderBook>;
  abstract fetchFundingRate(symbol: string): Promise<FundingRate>;
  abstract fetchOpenInterest(symbol: string): Promise<OpenInterest>;
}
