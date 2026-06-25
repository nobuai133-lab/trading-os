import type { KernelEvent, KernelEventInput } from '../types';
import type { PrismaClient, Prisma } from '@prisma/client';
import { KernelConfig } from '../KernelConfig';

export interface IEventStore {
  nextSeq(): Promise<bigint>;
  append(input: KernelEventInput, seq: bigint, previousSeq: bigint): Promise<KernelEvent>;
  readFrom(seq: bigint, limit?: number): Promise<KernelEvent[]>;
  getLatestSeq(): Promise<bigint>;
  readById(id: string): Promise<KernelEvent | null>;
}

type KernelEventRow = {
  id: string; seq: bigint; previousSeq: bigint; ts: Date | string;
  correlationId: string; sessionId: string; source: string;
  domain: string; type: string; version: number;
  tradeId: string | null; setupId: string | null;
  payload: unknown;
};

function rowToEvent(row: KernelEventRow): KernelEvent {
  return {
    id:            row.id,
    seq:           row.seq,
    previousSeq:   row.previousSeq,
    ts:            row.ts instanceof Date ? row.ts.toISOString() : String(row.ts),
    correlationId: row.correlationId,
    sessionId:     row.sessionId,
    source:        row.source,
    domain:        row.domain as KernelEvent['domain'],
    type:          row.type,
    version:       row.version,
    tradeId:       row.tradeId ?? undefined,
    setupId:       row.setupId ?? undefined,
    payload:       row.payload as Record<string, unknown>,
  };
}

export class PrismaEventStore implements IEventStore {
  constructor(private readonly prisma: PrismaClient) {}

  async getLatestSeq(): Promise<bigint> {
    const row = await this.prisma.kernelEvent.findFirst({
      orderBy: { seq: 'desc' },
      select:  { seq: true },
    });
    return row ? row.seq : 0n;
  }

  async nextSeq(): Promise<bigint> {
    return (await this.getLatestSeq()) + 1n;
  }

  async append(input: KernelEventInput, seq: bigint, previousSeq: bigint): Promise<KernelEvent> {
    const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const row = await this.prisma.kernelEvent.create({
      data: {
        id,
        seq,
        previousSeq,
        ts:            new Date(),
        correlationId: input.correlationId,
        sessionId:     KernelConfig.sessionId,
        source:        input.source,
        domain:        input.domain,
        type:          input.type,
        version:       input.version ?? 1,
        tradeId:       input.tradeId ?? null,
        setupId:       input.setupId ?? null,
        payload:       input.payload as Prisma.InputJsonValue,
      },
    });
    return rowToEvent(row);
  }

  async readFrom(fromSeq: bigint, limit = KernelConfig.maxReplayEvents): Promise<KernelEvent[]> {
    const rows = await this.prisma.kernelEvent.findMany({
      where:   { seq: { gte: fromSeq } },
      orderBy: { seq: 'asc' },
      take:    limit,
    });
    return rows.map(rowToEvent);
  }

  async readById(id: string): Promise<KernelEvent | null> {
    const row = await this.prisma.kernelEvent.findUnique({ where: { id } });
    return row ? rowToEvent(row) : null;
  }
}
