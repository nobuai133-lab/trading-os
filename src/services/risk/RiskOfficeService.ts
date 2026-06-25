import { logger }              from '@/core/logger';
import { getKernel }           from '@/kernel/singleton';
import { generateCorrelationId } from '@/core/correlationId';
import { tradeMemoryService }  from '@/services/memory/TradeMemoryService';
import { decisionService }     from '@/services/decision/DecisionService';
import { generateDNA }         from '@/lib/memory/memoryDNA';
import {
  computeRiskOffice,
  computePortfolioMetrics,
  computeRiskCooldown,
  DEFAULT_RISK_BUDGET,
  type RiskOfficeInput,
} from '@/lib/riskOfficeEngine';
import type { RiskOfficeResult, RiskBudget } from '@/types';

const CACHE_TTL_MS = 15_000; // 15s

const log = logger.withContext({ service: 'risk-office' });

function loadBudget(): RiskBudget {
  const e = process.env;
  return {
    maxRiskPerTradeR:       parseFloat(e.RO_MAX_RISK_PER_TRADE_R   ?? String(DEFAULT_RISK_BUDGET.maxRiskPerTradeR)),
    maxDailyLossR:          parseFloat(e.RO_MAX_DAILY_LOSS_R        ?? String(DEFAULT_RISK_BUDGET.maxDailyLossR)),
    maxWeeklyLossR:         parseFloat(e.RO_MAX_WEEKLY_LOSS_R       ?? String(DEFAULT_RISK_BUDGET.maxWeeklyLossR)),
    maxMonthlyLossR:        parseFloat(e.RO_MAX_MONTHLY_LOSS_R      ?? String(DEFAULT_RISK_BUDGET.maxMonthlyLossR)),
    maxConsecutiveLosses:   parseInt(  e.RO_MAX_CONSEC_LOSSES       ?? String(DEFAULT_RISK_BUDGET.maxConsecutiveLosses)),
    maxConsecutiveWins:     parseInt(  e.RO_MAX_CONSEC_WINS         ?? String(DEFAULT_RISK_BUDGET.maxConsecutiveWins)),
    cooldownAfterLossMin:   parseInt(  e.RO_COOLDOWN_LOSS_MIN       ?? String(DEFAULT_RISK_BUDGET.cooldownAfterLossMin)),
    cooldownAfterWinMin:    parseInt(  e.RO_COOLDOWN_WIN_MIN        ?? String(DEFAULT_RISK_BUDGET.cooldownAfterWinMin)),
    minConfidenceForTrade:  parseInt(  e.RO_MIN_CONFIDENCE          ?? String(DEFAULT_RISK_BUDGET.minConfidenceForTrade)),
    maxConcurrentPositions: parseInt(  e.RO_MAX_CONCURRENT          ?? String(DEFAULT_RISK_BUDGET.maxConcurrentPositions)),
    maxSameSymbolPositions: parseInt(  e.RO_MAX_SAME_SYMBOL         ?? String(DEFAULT_RISK_BUDGET.maxSameSymbolPositions)),
  };
}

interface CacheEntry {
  result:    RiskOfficeResult;
  expiresAt: number;
}

export class RiskOfficeService {
  private _cache: CacheEntry | null = null;

  async getResult(): Promise<RiskOfficeResult> {
    const now = Date.now();
    if (this._cache && now < this._cache.expiresAt) {
      return this._cache.result;
    }
    return this._compute();
  }

  invalidate(): void {
    this._cache = null;
  }

  private async _compute(): Promise<RiskOfficeResult> {
    const records = tradeMemoryService.getAll();
    const budget  = loadBudget();
    const now     = new Date();

    const metrics  = computePortfolioMetrics(records, now);
    const cooldown = computeRiskCooldown(records, budget, now);

    // Decision — non-blocking, use cached or null
    let decisionResult = null;
    try {
      decisionResult = await decisionService.getDecision();
    } catch (err) {
      log.warn('decision unavailable for risk office', { err: String(err) });
    }

    // Similarity — derive from current fingerprint
    let similarity = null;
    if (decisionResult) {
      try {
        const fingerprint = await tradeMemoryService.getCurrentFingerprint();
        if (fingerprint) {
          const dna = generateDNA(fingerprint);
          similarity = await tradeMemoryService.getSimilarity(dna, decisionResult.confidence);
        }
      } catch (err) {
        log.warn('similarity unavailable for risk office', { err: String(err) });
      }
    }

    // Kernel + provider health
    let kernelHealthy   = true;
    let providerHealthy = false;
    let openPositions   = 0;

    try {
      const kernel = await getKernel();
      kernelHealthy = kernel.isInitialized();

      if (kernelHealthy) {
        const provState  = kernel.readState('provider') as unknown as Record<string, unknown>;
        providerHealthy  = Boolean(provState?.activeProvider);

        const tradeState = kernel.readState('trade') as unknown as Record<string, unknown>;
        const phase      = String(tradeState?.phase ?? '');
        openPositions    = ['POSITION_OPEN', 'TP1_REACHED', 'TP2_REACHED', 'TP3_REACHED'].includes(phase) ? 1 : 0;
      }
    } catch {
      kernelHealthy = false;
    }

    const inputData: RiskOfficeInput = {
      metrics, budget, decision: decisionResult, similarity,
      cooldown, providerHealthy, kernelHealthy, openPositions,
    };

    const result = computeRiskOffice(inputData);

    log.info('computed', { decision: result.decision, riskState: result.riskState, finalR: result.positionSize.finalR });

    void this._writeKernelAudit(result);

    this._cache = { result, expiresAt: Date.now() + CACHE_TTL_MS };
    return result;
  }

  private async _writeKernelAudit(result: RiskOfficeResult): Promise<void> {
    try {
      const kernel = await getKernel();
      await kernel.writeEvent({
        correlationId: generateCorrelationId(),
        source:        'risk-office',
        domain:        'risk',
        type:          'RiskOfficeComputed',
        version:       1,
        payload: {
          decision:         result.decision,
          riskState:        result.riskState,
          finalR:           result.positionSize.finalR,
          killSwitchActive: result.killSwitchActive,
          vetoCount:        result.vetos.length,
        },
      });
    } catch (err) {
      log.warn('RiskOfficeComputed kernel write failed (non-fatal)', { err: String(err) });
    }
  }
}

export const riskOfficeService = new RiskOfficeService();
