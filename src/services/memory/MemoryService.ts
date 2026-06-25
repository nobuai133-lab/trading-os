import {
  isDuplicateWebhook,
  getOrCreateRange,
  getOrCreateFingerprint,
  markRangeTraded,
  markFingerprintTraded,
  createCooldown,
  getActiveCooldown,
  logWebhookEvent,
} from '@/lib/memoryEngine';
import { logger }           from '@/core/logger';
import { eventBus }         from '@/core/eventBus';
import { generateCorrelationId } from '@/core/correlationId';
import type { WebhookSignal } from '@/lib/signalProvider';

const log = logger.withContext({ service: 'memory' });

export class MemoryService {
  async isDuplicate(setupId: string): Promise<boolean> {
    return isDuplicateWebhook(setupId);
  }

  async getRange(signal: WebhookSignal, correlationId = generateCorrelationId()) {
    log.debug('getRange', { correlationId, symbol: signal.symbol });
    return getOrCreateRange(signal);
  }

  async getFingerprint(signal: WebhookSignal, correlationId = generateCorrelationId()) {
    log.debug('getFingerprint', { correlationId, symbol: signal.symbol });
    return getOrCreateFingerprint(signal);
  }

  async markRangeTraded(
    symbol: string,
    timeframe: string,
    rangeHigh: number,
    rangeLow: number,
    direction: string,
    result: string,
  ): Promise<void> {
    await markRangeTraded(symbol, timeframe, rangeHigh, rangeLow, direction, result);
    eventBus.emit('memory.updated', { symbol, type: 'range' });
  }

  async markFingerprintTraded(fingerprintId: string, result: string): Promise<void> {
    await markFingerprintTraded(fingerprintId, result);
    eventBus.emit('memory.updated', { symbol: '', type: 'fingerprint' });
  }

  async startCooldown(
    symbol: string,
    timeframe: string,
    setupId: string | null,
    bars: number,
    reason: string,
    correlationId = generateCorrelationId(),
  ): Promise<void> {
    log.info('startCooldown', { correlationId, symbol, timeframe, bars, reason });
    await createCooldown(symbol, timeframe, setupId, bars, reason);
    eventBus.emit('cooldown.started', { symbol, timeframe, bars, reason });
    eventBus.emit('memory.updated', { symbol, type: 'cooldown' });
  }

  async getActiveCooldown(symbol: string, timeframe: string) {
    return getActiveCooldown(symbol, timeframe);
  }

  async logWebhook(params: Parameters<typeof logWebhookEvent>[0]): Promise<void> {
    await logWebhookEvent(params);
  }
}

export const memoryService = new MemoryService();

