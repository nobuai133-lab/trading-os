import { logger }                            from '@/core/logger';
import { getKernel }                          from '@/kernel/singleton';
import { initialStrategyState }              from '@/kernel/domains/StrategyState';
import { initialMemoryState }                from '@/kernel/domains/MemoryState';
import { initialProviderState }              from '@/kernel/domains/ProviderState';
import { initialRiskState }                  from '@/kernel/domains/RiskState';
import { initialEvidenceState }              from '@/kernel/domains/EvidenceState';
import { initialTradeState }                 from '@/kernel/domains/TradeState';
import { computeDecision, type DecisionInput } from '@/lib/decisionEngine';
import type { DecisionResult }               from '@/types';
import { generateCorrelationId }             from '@/core/correlationId';

const CACHE_TTL_MS = 30_000; // 30s — recompute after signals change

const log = logger.withContext({ service: 'decision' });

interface CacheEntry {
  result:    DecisionResult;
  expiresAt: number;
}

export class DecisionService {
  private _cache: CacheEntry | null = null;

  async getDecision(): Promise<DecisionResult> {
    const now = Date.now();
    if (this._cache && now < this._cache.expiresAt) {
      return this._cache.result;
    }
    return this._compute();
  }

  // Force recompute on next call (called after new evidence arrives)
  invalidate(): void {
    this._cache = null;
  }

  private async _compute(): Promise<DecisionResult> {
    let evidence = initialEvidenceState();
    let strategy = initialStrategyState();
    let memory   = initialMemoryState();
    let provider = initialProviderState();
    let risk     = initialRiskState();
    let trade    = initialTradeState();

    try {
      const kernel = await getKernel();
      if (kernel.isInitialized()) {
        evidence = kernel.readState('evidence');
        strategy = kernel.readState('strategy');
        memory   = kernel.readState('memory');
        provider = kernel.readState('provider');
        risk     = kernel.readState('risk');
        trade    = kernel.readState('trade');
      }
    } catch {
      log.warn('kernel unavailable for decision computation — using default state');
    }

    const input: DecisionInput = { evidence, strategy, memory, provider, risk, trade };
    const result = computeDecision(input);

    log.info('computed', {
      outcome:    result.outcome,
      confidence: result.confidence,
      score:      `${result.weightedScore}/${result.maxScore}`,
    });

    // Audit write — fire-and-forget, never blocks response
    void this._writeKernelAudit(result);

    this._cache = { result, expiresAt: Date.now() + CACHE_TTL_MS };
    return result;
  }

  private async _writeKernelAudit(result: DecisionResult): Promise<void> {
    try {
      const kernel = await getKernel();
      await kernel.writeEvent({
        correlationId: generateCorrelationId(),
        source:        'decision-service',
        domain:        'risk',
        type:          'DecisionComputed',
        version:       1,
        payload: {
          outcome:        result.outcome,
          confidence:     result.confidence,
          weightedScore:  result.weightedScore,
          blockingReason: result.blockingReason,
        },
      });
    } catch (err) {
      log.warn('DecisionComputed kernel write failed (non-fatal)', { err: String(err) });
    }
  }
}

export const decisionService = new DecisionService();
