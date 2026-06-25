import { ProviderManager }      from './providerManager';
import { validateOHLCV, timeframeToMs } from './validator';
import { KrakenProvider }       from './providers/KrakenProvider';
import { BinanceProvider }      from './providers/BinanceProvider';
import { TradingViewProvider }  from './providers/TradingViewProvider';
import { BybitProvider }        from './providers/BybitProvider';
import { CoinbaseProvider }     from './providers/CoinbaseProvider';
import { BinanceWsProvider }    from './providers/BinanceWsProvider';
import { eventBus }             from '../../core/eventBus';
import { logger }               from '../logger';
import type { OHLCVBar, Ticker, ValidationResult, ProviderHealth, FailoverEvent } from './types';

const MAX_RETRIES = 3;

class MarketDataEngine {
  private manager: ProviderManager;
  private initialized = false;

  constructor() {
    this.manager = new ProviderManager([
      new BinanceProvider(),
      new TradingViewProvider(),
      new BinanceWsProvider(),
      new BybitProvider(),
      new CoinbaseProvider(),
      new KrakenProvider(),
    ]);
  }

  init(): void {
    if (this.initialized) return;
    this.manager.startHealthChecks();
    this.initialized = true;
  }

  destroy(): void {
    this.manager.stopHealthChecks();
    this.initialized = false;
  }

  // ── public API ───────────────────────────────────────────────────────────────

  async fetchOHLCV(symbol: string, timeframe: string, limit = 200): Promise<OHLCVBar[]> {
    return this.withFallback((p) => p.fetchOHLCV(symbol, timeframe, limit));
  }

  async fetchOHLCVValidated(symbol: string, timeframe: string, limit = 200): Promise<ValidationResult> {
    const bars = await this.fetchOHLCV(symbol, timeframe, limit);
    return validateOHLCV(bars, timeframeToMs(timeframe));
  }

  async fetchTicker(symbol: string): Promise<Ticker> {
    return this.withFallback((p) => p.fetchTicker(symbol));
  }

  async fetchCurrentPrice(symbol: string): Promise<number> {
    const ticker = await this.fetchTicker(symbol);
    return ticker.last;
  }

  getProviderHealth(): ProviderHealth[] {
    return this.manager.getAllHealth();
  }

  getActiveProvider(): string {
    return this.manager.getActive().name;
  }

  getFailoverLog(): FailoverEvent[] {
    return this.manager.getFailoverLog();
  }

  // ── fallback execution ───────────────────────────────────────────────────────

  private async withFallback<T>(
    fn: (provider: ReturnType<ProviderManager['getActive']>) => Promise<T>,
  ): Promise<T> {
    const available = this.manager.getAvailable();
    if (available.length === 0) {
      throw new Error('No market data providers available');
    }

    let lastErr: Error | undefined;

    for (let attempt = 0; attempt < Math.min(MAX_RETRIES, available.length); attempt++) {
      const provider = this.manager.getActive();
      try {
        const result = await fn(provider);

        // Emit price update if we got a ticker-like result
        if (result && typeof result === 'object' && 'last' in result) {
          const t = result as unknown as Ticker;
          eventBus.emit('market.updated', {
            symbol:   t.symbol,
            price:    t.last,
            regime:   'unknown',
            provider: provider.name,
            ts:       t.ts,
          });
        }

        return result;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        logger.warn('marketData.providerError', { provider: provider.name, err: lastErr.message, attempt });

        const next = this.manager.failover(lastErr.message);
        if (!next) break;
      }
    }

    throw lastErr ?? new Error('All providers failed');
  }
}

// Singleton
export const marketDataEngine = new MarketDataEngine();
