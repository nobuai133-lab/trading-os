import { processWebhookSignal }   from '@/lib/tradeLifecycle';
import { logger }                from '@/core/logger';
import { eventBus }              from '@/core/eventBus';
import { generateCorrelationId } from '@/core/correlationId';
import { tradeMemoryService }    from '@/services/memory/TradeMemoryService';
import type { WebhookSignal }    from '@/lib/signalProvider';

const log = logger.withContext({ service: 'lifecycle' });

export class LifecycleService {
  async process(
    signal: WebhookSignal,
    rawPayload: object,
    correlationId = generateCorrelationId(),
  ): Promise<void> {
    log.info('process', { correlationId, symbol: signal.symbol, signal: signal.signal });

    await processWebhookSignal(signal, rawPayload);

    // After successful processing, emit the appropriate domain event.
    // DashboardService subscribes to these and rebuilds state asynchronously â€”
    // the webhook handler does not call buildDashboardState() directly.
    switch (signal.signal) {
      case 'ENTRY_TRIGGERED':
        // tradeId is not known here without DB read; dashboard will rebuild from events
        eventBus.emit('signal.created', { correlationId, symbol: signal.symbol, signal: signal.signal });
        break;
      case 'TP1_HIT':
      case 'TP2_HIT':
      case 'TP3_HIT':
        eventBus.emit('signal.created', { correlationId, symbol: signal.symbol, signal: signal.signal });
        break;
      case 'SL_HIT':
      case 'CLOSE_TRADE':
        eventBus.emit('signal.created', { correlationId, symbol: signal.symbol, signal: signal.signal });
        void tradeMemoryService.record(signal, correlationId);
        break;
      default:
        break;
    }
  }
}

export const lifecycleService = new LifecycleService();

