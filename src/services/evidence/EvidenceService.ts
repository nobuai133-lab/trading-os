import { logger }                              from '@/core/logger';
import { getKernel }                           from '@/kernel/singleton';
import { initialStrategyState }               from '@/kernel/domains/StrategyState';
import { initialMemoryState }                 from '@/kernel/domains/MemoryState';
import { evaluateEvidence, type EvidenceResult } from '@/lib/evidenceEngine';
import type { WebhookSignal }                 from '@/lib/signalProvider';

const log = logger.withContext({ service: 'evidence' });

// EvidenceService evaluates incoming setup signals against the 5-category model
// defined in constitution/03-Evidence-Engine.md.
//
// On SETUP_DETECTED: reads current kernel strategy + memory state, scores the
// evidence, and emits an EvidenceUpdated kernel event. Fire-and-forget safe.

export class EvidenceService {
  async evaluate(signal: WebhookSignal, correlationId: string): Promise<EvidenceResult> {
    // Get current kernel state for context; fall back to defaults if unavailable
    let strategy  = initialStrategyState();
    let memory    = initialMemoryState();

    try {
      const kernel = await getKernel();
      if (kernel.isInitialized()) {
        strategy = kernel.readState('strategy');
        memory   = kernel.readState('memory');
      }
    } catch {
      log.warn('kernel unavailable for evidence evaluation — using default state');
    }

    const result = evaluateEvidence({ signal, strategy, memory });

    log.info('evaluated', {
      correlationId,
      grade:      result.grade,
      confidence: result.confidence,
      categories: result.categories.map((c) => `${c.name}:${c.present ? '✓' : '✗'}`).join(' '),
    });

    // Write EvidenceUpdated kernel event (fire-and-forget — never blocks signal processing)
    void this._persistToKernel(signal, result, correlationId);

    return result;
  }

  private async _persistToKernel(
    signal: WebhookSignal,
    result: EvidenceResult,
    correlationId: string,
  ): Promise<void> {
    try {
      const kernel = await getKernel();
      await kernel.writeEvent({
        correlationId,
        source:  'evidence-service',
        domain:  'evidence',
        type:    'EvidenceUpdated',
        version: 1,
        payload: {
          correlationId,
          symbol:     signal.symbol,
          setupId:    signal.setupId,
          grade:      result.grade,
          confidence: result.confidence,
          categories: result.categories,
        },
      });
    } catch (err) {
      log.warn('kernel EvidenceUpdated write failed (non-fatal)', { err: String(err) });
    }
  }
}

export const evidenceService = new EvidenceService();
