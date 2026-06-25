import { evaluateRisk, isKillSwitchActive } from '@/lib/riskEngine';
import { logger }                           from '@/core/logger';
import { eventBus }                         from '@/core/eventBus';
import { config }                           from '@/core/config';
import { generateCorrelationId }            from '@/core/correlationId';
import { RiskRejectedError }                from '@/core/errors';
import type { WebhookSignal }               from '@/lib/signalProvider';
import type { RiskDecision }               from '@/lib/riskEngine';

const log = logger.withContext({ service: 'risk' });

export class RiskService {
  evaluate(
    signal: WebhookSignal,
    correlationId = generateCorrelationId(),
  ): RiskDecision {
    const decision = evaluateRisk(signal);
    log.debug('evaluate', { correlationId, symbol: signal.symbol, allowed: decision.allowed, reason: decision.reason });

    if (!decision.allowed) {
      const gate = this.inferGate(decision.reason ?? '');
      eventBus.emit('risk.rejected', {
        correlationId,
        symbol: signal.symbol,
        reason: decision.reason ?? 'unknown',
        gate,
      });
    }

    return decision;
  }

  evaluateOrThrow(
    signal: WebhookSignal,
    correlationId = generateCorrelationId(),
  ): RiskDecision {
    const decision = this.evaluate(signal, correlationId);
    if (!decision.allowed) {
      const gate = this.inferGate(decision.reason ?? '');
      throw new RiskRejectedError(decision.reason ?? 'Risk rejected', gate, correlationId);
    }
    return decision;
  }

  isKillSwitchActive(): boolean {
    return isKillSwitchActive();
  }

  getTradingMode() {
    return config.exchange.tradingMode;
  }

  private inferGate(reason: string): string {
    if (reason.includes('Kill switch'))    return 'KILL_SWITCH';
    if (reason.includes('Grade'))          return 'GRADE';
    if (reason.includes('RR'))             return 'RR';
    if (reason.includes('Confidence'))     return 'CONFIDENCE';
    return 'OTHER';
  }
}

export const riskService = new RiskService();

