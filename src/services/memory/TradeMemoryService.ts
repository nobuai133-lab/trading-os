import { logger }                    from '@/core/logger';
import { prisma }                    from '@/lib/db';
import { getKernel }                 from '@/kernel/singleton';
import { generateCorrelationId }     from '@/core/correlationId';
import { generateFingerprint }       from '@/lib/memory/memoryFingerprint';
import { generateDNA, hashDNA }      from '@/lib/memory/memoryDNA';
import { computeSimilarity, buildSimilarityWarnings } from '@/lib/memory/similarityEngine';
import { generateLessons }           from '@/lib/memory/experienceEngine';
import { calibrateConfidence }       from '@/lib/memory/confidenceCalibrator';
import type { WebhookSignal }        from '@/lib/signalProvider';
import type {
  TradeMemoryRecord, TradeOutcome, SetupFingerprintData,
  MemorySummary, SimilarityResult, SimilarityMatch, ExperienceLesson,
  ExperienceLevel,
} from '@/types';

const log = logger.withContext({ service: 'trade-memory' });

// ── Helpers ───────────────────────────────────────────────────────────────────

function toOutcome(resultR: number): TradeOutcome {
  if (resultR >  0.05) return 'WIN';
  if (resultR < -0.05) return 'LOSS';
  return 'BREAK_EVEN';
}

function toExperienceLevel(count: number): ExperienceLevel {
  if (count < 5)  return 'INSUFFICIENT';
  if (count < 20) return 'LOW';
  if (count < 50) return 'MODERATE';
  return 'HIGH';
}

function computeExitPrice(trade: {
  sl?: number; tp1?: number; tp2?: number; tp3?: number;
  tp1Hit: boolean; tp2Hit: boolean; tp3Hit: boolean; entry?: number;
}, signalType: string): number {
  if (signalType === 'SL_HIT') return trade.sl ?? 0;
  if (trade.tp3Hit && trade.tp3) return trade.tp3;
  if (trade.tp2Hit && trade.tp2) return trade.tp2;
  if (trade.tp1Hit && trade.tp1) return trade.tp1;
  return trade.entry ?? 0;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class TradeMemoryService {
  private readonly _store  = new Map<string, TradeMemoryRecord>();
  private _experienceCache: ExperienceLesson[] | null = null;
  private _initialized     = false;

  // ── Initialization ──────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this._initialized) return;
    try {
      const events = await prisma.kernelEvent.findMany({
        where:   { type: 'TradeMemoryRecorded' },
        orderBy: [{ seq: 'asc' }],
      });

      for (const ev of events) {
        const record = ev.payload as unknown as TradeMemoryRecord;
        if (record?.tradeId) {
          this._store.set(record.tradeId, record);
        }
      }

      this._initialized = true;
      log.info('initialized', { tradeCount: this._store.size });
    } catch (err) {
      log.warn('initialization failed — memory will be empty this session', { err: String(err) });
      this._initialized = true;
    }
  }

  // ── Record a completed trade ────────────────────────────────────────────────

  async record(signal: WebhookSignal, correlationId: string): Promise<void> {
    if (!this._initialized) await this.initialize();

    try {
      const kernel = await getKernel();
      if (!kernel.isInitialized()) return;

      const trade    = kernel.readState('trade');
      const evidence = kernel.readState('evidence');
      const strategy = kernel.readState('strategy');
      const market   = kernel.readState('market');
      const memory   = kernel.readState('memory');

      // Only record when there was an active trade with entry price
      if (!trade.entry || trade.phase === 'IDLE') {
        log.info('skip — no active trade', { signal: signal.signal });
        return;
      }

      // Determine R-multiple from prices (trade.resultR may not be set yet at close time)
      const exit   = computeExitPrice(trade, signal.signal);
      const entry  = trade.entry;
      const sl     = trade.sl ?? 0;
      const dir    = (trade.direction?.toUpperCase() as 'LONG' | 'SHORT') ?? 'LONG';

      let resultR = 0;
      if (sl > 0 && entry !== sl) {
        const distance = Math.abs(entry - sl);
        resultR = dir === 'LONG'
          ? (exit - entry) / distance
          : (entry - exit) / distance;
      }

      const outcome    = toOutcome(resultR);
      const fingerprint = generateFingerprint(evidence, strategy, trade, memory, market.provider);
      const dna        = generateDNA(fingerprint);
      const dnaHash    = hashDNA(dna);

      const rr = trade.tp1 && entry && sl && entry !== sl
        ? Math.abs(trade.tp1 - entry) / Math.abs(entry - sl) : 0;

      const record: TradeMemoryRecord = {
        tradeId:               trade.tradeId ?? `trade_${Date.now()}`,
        decisionId:            correlationId,
        symbol:                trade.symbol    ?? market.symbol,
        timeframe:             trade.timeframe ?? strategy.timeframe,
        regime:                strategy.regime,
        provider:              market.provider,
        htfBias:               strategy.htfBias,
        ltfBias:               strategy.ltfBias,
        evidenceGrade:         evidence.grade,
        evidenceConfidence:    evidence.confidence,
        evidenceCategories:    evidence.categories.map((c) => ({
          name: c.name, present: c.present, score: c.score,
        })),
        decisionOutcome:       signal.signal === 'SL_HIT' ? 'LOSS' : 'CLOSED',
        decisionConfidence:    evidence.confidence,
        decisionWeightedScore: 0,
        direction:             dir,
        grade:                 evidence.grade,
        rr,
        riskPct:               trade.riskPct ?? 0,
        entry,
        sl:                    sl,
        tp1:                   trade.tp1 ?? 0,
        tp2:                   trade.tp2 ?? 0,
        tp3:                   trade.tp3 ?? 0,
        exit,
        outcome,
        resultR:               Math.round(resultR * 100) / 100,
        closeReason:           trade.closeReason ?? signal.signal,
        openedAt:              trade.openedAt    ?? new Date().toISOString(),
        closedAt:              new Date().toISOString(),
        durationMs:            trade.openedAt
                                 ? Date.now() - new Date(trade.openedAt).getTime() : 0,
        fingerprint,
        dna,
        dnaHash,
        confidenceBefore:      evidence.confidence,
        confidenceAfter:       evidence.confidence,
        lessons:               [],
        tags:                  [],
      };

      // Persist to kernel event log — immutable governance record
      await kernel.writeEvent({
        correlationId,
        source:  'trade-memory',
        domain:  'memory',
        type:    'TradeMemoryRecorded',
        version: 1,
        tradeId: record.tradeId,
        payload: record as unknown as Record<string, unknown>,
      });

      this._store.set(record.tradeId, record);
      this._experienceCache = null;

      log.info('recorded', {
        tradeId: record.tradeId, outcome, resultR: record.resultR, dnaHash,
      });
    } catch (err) {
      log.warn('record failed (non-fatal)', { err: String(err) });
    }
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  async getSummary(): Promise<MemorySummary> {
    if (!this._initialized) await this.initialize();

    const records = Array.from(this._store.values());
    const wins    = records.filter((r) => r.outcome === 'WIN').length;
    const losses  = records.filter((r) => r.outcome === 'LOSS').length;
    const be      = records.filter((r) => r.outcome === 'BREAK_EVEN').length;
    const totalR  = records.reduce((s, r) => s + r.resultR, 0);

    return {
      tradeCount:     records.length,
      winCount:       wins,
      lossCount:      losses,
      breakEvenCount: be,
      winRate:        records.length > 0 ? Math.round((wins / records.length) * 1000) / 1000 : 0,
      avgResultR:     records.length > 0 ? Math.round(totalR / records.length * 100) / 100 : 0,
      totalR:         Math.round(totalR * 100) / 100,
      experienceLevel: toExperienceLevel(records.length),
      lastUpdated:    new Date().toISOString(),
    };
  }

  async getSimilarity(queryDNA: string[], baseConfidence: number): Promise<SimilarityResult> {
    if (!this._initialized) await this.initialize();

    const records = Array.from(this._store.values());
    const winners = records.filter((r) => r.outcome === 'WIN');
    const losers  = records.filter((r) => r.outcome === 'LOSS');

    function topMatches(pool: TradeMemoryRecord[], n: number): SimilarityMatch[] {
      return pool
        .map((r) => ({ record: r, similarity: computeSimilarity(queryDNA, r.dna) }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, n);
    }

    const topWinners = topMatches(winners, 3);
    const topLosers  = topMatches(losers, 3);

    const winningSim = topWinners.length > 0
      ? Math.round(topWinners.reduce((s, m) => s + m.similarity, 0) / topWinners.length) : 0;
    const losingSim  = topLosers.length > 0
      ? Math.round(topLosers.reduce((s, m) => s + m.similarity, 0) / topLosers.length) : 0;

    const simConfidence = Math.min(100,
      Math.round(Math.min(winners.length, losers.length) / 5 * 100));

    const calibrated = calibrateConfidence(
      baseConfidence, winningSim, losingSim, records.length,
    );

    const warnings = buildSimilarityWarnings(
      queryDNA,
      topLosers.map((m) => m.record.dna),
    );

    return {
      winningSimilarity:             winningSim,
      losingSimilarity:              losingSim,
      nearestWinner:                 topWinners[0] ?? null,
      nearestLoser:                  topLosers[0]  ?? null,
      topWinners,
      topLosers,
      sampleSize:                    records.length,
      similarityConfidence:          simConfidence,
      calibratedDecisionConfidence:  calibrated,
      warnings,
    };
  }

  async getExperience(): Promise<ExperienceLesson[]> {
    if (!this._initialized) await this.initialize();
    if (this._experienceCache) return this._experienceCache;
    const lessons = generateLessons(Array.from(this._store.values()));
    this._experienceCache = lessons;
    return lessons;
  }

  async getCurrentFingerprint(): Promise<SetupFingerprintData | null> {
    try {
      const kernel = await getKernel();
      if (!kernel.isInitialized()) return null;
      return generateFingerprint(
        kernel.readState('evidence'),
        kernel.readState('strategy'),
        kernel.readState('trade'),
        kernel.readState('memory'),
        kernel.readState('market').provider,
      );
    } catch {
      return null;
    }
  }

  getAll(): TradeMemoryRecord[] {
    return Array.from(this._store.values());
  }

  isInitialized(): boolean { return this._initialized; }
}

export const tradeMemoryService = new TradeMemoryService();
