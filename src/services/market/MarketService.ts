import { marketDataEngine }    from '@/lib/marketData/engine';
import { logger }              from '@/core/logger';
import { eventBus }            from '@/core/eventBus';
import { generateCorrelationId } from '@/core/correlationId';
import type { OHLCVBar, ProviderHealth, FailoverEvent } from '@/lib/marketData/types';

const log = logger.withContext({ service: 'market' });

export class MarketService {
  async getOHLCV(
    symbol: string,
    timeframe: string,
    limit = 200,
    correlationId = generateCorrelationId(),
  ): Promise<OHLCVBar[]> {
    log.debug('getOHLCV', { correlationId, symbol, timeframe, limit });
    return marketDataEngine.fetchOHLCV(symbol, timeframe, limit);
  }

  async getCurrentPrice(
    symbol: string,
    correlationId = generateCorrelationId(),
  ): Promise<number> {
    log.debug('getCurrentPrice', { correlationId, symbol });
    const ticker = await marketDataEngine.fetchTicker(symbol);

    eventBus.emit('market.updated', {
      symbol,
      price:    ticker.last,
      regime:   'unknown',
      provider: marketDataEngine.getActiveProvider(),
      ts:       ticker.ts,
    });

    return ticker.last;
  }

  getProviderHealth(): ProviderHealth[] {
    return marketDataEngine.getProviderHealth();
  }

  getActiveProvider(): string {
    return marketDataEngine.getActiveProvider();
  }

  getFailoverLog(): FailoverEvent[] {
    return marketDataEngine.getFailoverLog();
  }
}

export const marketService = new MarketService();

