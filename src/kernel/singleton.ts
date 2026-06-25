import { prisma }             from '@/lib/db';
import { CoreStateKernel }   from './KernelAPI';
import { PrismaEventStore }  from './store/EventStore';
import { PrismaSnapshotStore } from './store/SnapshotStore';
import { logger }            from '@/core/logger';
import { seedKernelFromSystemState } from '@/lib/kernel/kernelSeeder';

const log = logger.withContext({ service: 'kernel-singleton' });

// Global singleton across Next.js hot-reloads (Node.js runtime only — not Edge).
const g = globalThis as unknown as {
  __kernel:      CoreStateKernel | undefined;
  __kernelReady: Promise<CoreStateKernel> | undefined;
};

export async function getKernel(): Promise<CoreStateKernel> {
  if (g.__kernel) return g.__kernel;
  if (g.__kernelReady) return g.__kernelReady;

  g.__kernelReady = (async () => {
    const kernel = new CoreStateKernel(
      new PrismaEventStore(prisma),
      new PrismaSnapshotStore(prisma),
    );
    await kernel.initialize();

    // Cold boot: no events in store → seed from current SystemState so the
    // dashboard is immediately authoritative after Stage 3 promotion.
    if (kernel.getEventCount() === 0) {
      await seedKernelFromSystemState(kernel).catch((err) => {
        log.warn('kernel seeding failed — continuing with default state', { err: String(err) });
      });
    }

    log.info('ready', { eventCount: kernel.getEventCount() });
    g.__kernel = kernel;
    return kernel;
  })();

  try {
    return await g.__kernelReady;
  } catch (err) {
    g.__kernelReady = undefined; // allow retry on next call
    throw err;
  }
}

// Safe getter — returns null if not initialized, never throws.
export function getKernelSync(): CoreStateKernel | null {
  return g.__kernel ?? null;
}
