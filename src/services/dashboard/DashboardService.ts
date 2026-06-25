import { buildDashboardState, persistDashboardState } from '@/lib/stateBuilder';
import { logger }                from '@/core/logger';
import { eventBus }              from '@/core/eventBus';
import { getKernel }             from '@/kernel/singleton';
import { adaptKernelState }      from '@/lib/kernel/kernelStateAdapter';
import { isKernelAuthority, getAuthorityMode } from '@/lib/kernel/authorityConfig';
import type { DashboardState }   from '@/types';

const log = logger.withContext({ service: 'dashboard' });

// DashboardService subscribes to domain events and rebuilds state asynchronously.
// This decouples state refresh from the webhook hot path — the tradeLifecycle handler
// no longer calls buildDashboardState() synchronously.
//
// In Stage 3+: when KERNEL_AUTHORITY !== 'false', the kernel overlay is applied after
// the legacy base build. Kernel fields are authoritative; untracked fields fall through.
// Rollback: set KERNEL_AUTHORITY=false on Railway (Level C).

export class DashboardService {
  private cache: DashboardState | null = null;
  private rebuilding = false;
  private subscribed = false;

  subscribe(): void {
    if (this.subscribed) return;
    this.subscribed = true;

    const triggerRebuild = () => void this.rebuild();

    eventBus.on('market.updated',   triggerRebuild);
    eventBus.on('signal.created',   triggerRebuild);
    eventBus.on('trade.opened',     triggerRebuild);
    eventBus.on('trade.closed',     triggerRebuild);
    eventBus.on('tp1.hit',          triggerRebuild);
    eventBus.on('tp2.hit',          triggerRebuild);
    eventBus.on('tp3.hit',          triggerRebuild);
    eventBus.on('cooldown.started', triggerRebuild);
    eventBus.on('bias.reset',       triggerRebuild);
    eventBus.on('memory.updated',   triggerRebuild);
  }

  unsubscribe(): void {
    if (!this.subscribed) return;
    eventBus.removeAllListeners('market.updated');
    this.subscribed = false;
  }

  async getState(): Promise<DashboardState> {
    if (!this.cache) {
      this.cache = await this._build();
    }
    return this.cache;
  }

  async rebuild(): Promise<void> {
    if (this.rebuilding) return;
    this.rebuilding = true;
    try {
      const state  = await this._build();
      this.cache   = state;
      await persistDashboardState(state);
      log.debug('rebuilt', { authority: getAuthorityMode() });
    } catch (err) {
      log.error('rebuild failed', { err: String(err) });
    } finally {
      this.rebuilding = false;
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _build(): Promise<DashboardState> {
    const base = await buildDashboardState();

    if (!isKernelAuthority()) return base;

    try {
      const kernel = await getKernel();
      if (!kernel.isInitialized()) return base;
      return adaptKernelState(kernel.readFullState(), base);
    } catch (err) {
      log.warn('kernel read failed — falling back to legacy state', { err: String(err) });
      return base;
    }
  }
}

export const dashboardService = new DashboardService();
