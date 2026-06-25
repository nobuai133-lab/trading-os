import type { KernelSnapshot, KernelFullState } from '../types';
import type { PrismaClient } from '@prisma/client';
import { bigIntReplacer, reviveBigIntFields } from '../types';

export interface ISnapshotStore {
  save(snapshot: KernelSnapshot): Promise<void>;
  loadLatest(): Promise<KernelSnapshot | null>;
  loadAt(seq: bigint): Promise<KernelSnapshot | null>;
}

type SnapshotRow = {
  id: string; seq: bigint; createdAt: Date; eventCount: number; state: unknown;
};

function rowToSnapshot(row: SnapshotRow): KernelSnapshot {
  return {
    id:         row.id,
    seq:        row.seq,
    createdAt:  row.createdAt.toISOString(),
    eventCount: row.eventCount,
    state:      reviveBigIntFields(row.state) as KernelFullState,
  };
}

export class PrismaSnapshotStore implements ISnapshotStore {
  constructor(private readonly prisma: PrismaClient) {}

  async save(snapshot: KernelSnapshot): Promise<void> {
    const stateJson = JSON.parse(JSON.stringify(snapshot.state, bigIntReplacer));
    await this.prisma.kernelSnapshot.upsert({
      where:  { id: snapshot.id },
      create: {
        id:         snapshot.id,
        seq:        snapshot.seq,
        createdAt:  new Date(snapshot.createdAt),
        eventCount: snapshot.eventCount,
        state:      stateJson,
      },
      update: {
        seq:        snapshot.seq,
        createdAt:  new Date(snapshot.createdAt),
        eventCount: snapshot.eventCount,
        state:      stateJson,
      },
    });
  }

  async loadLatest(): Promise<KernelSnapshot | null> {
    const row = await this.prisma.kernelSnapshot.findFirst({
      orderBy: { seq: 'desc' },
    });
    return row ? rowToSnapshot(row) : null;
  }

  async loadAt(seq: bigint): Promise<KernelSnapshot | null> {
    const row = await this.prisma.kernelSnapshot.findFirst({
      where:   { seq: { lte: seq } },
      orderBy: { seq: 'desc' },
    });
    return row ? rowToSnapshot(row) : null;
  }
}
