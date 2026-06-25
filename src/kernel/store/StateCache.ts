import type { KernelDomain, KernelFullState, DomainStates } from '../types';
import { KERNEL_DOMAINS } from '../types';

export class StateCache {
  private readonly cache = new Map<KernelDomain, DomainStates[KernelDomain]>();

  get<K extends KernelDomain>(domain: K): DomainStates[K] | undefined {
    return this.cache.get(domain) as DomainStates[K] | undefined;
  }

  set<K extends KernelDomain>(domain: K, state: DomainStates[K]): void {
    this.cache.set(domain, state);
  }

  getAll(): KernelFullState | null {
    if (!this.isInitialized()) return null;
    const out: Partial<KernelFullState> = {};
    for (const domain of KERNEL_DOMAINS) {
      (out as Record<string, unknown>)[domain] = this.cache.get(domain);
    }
    return out as KernelFullState;
  }

  setAll(state: KernelFullState): void {
    for (const domain of KERNEL_DOMAINS) {
      this.cache.set(domain, state[domain]);
    }
  }

  isInitialized(): boolean {
    return KERNEL_DOMAINS.every((d) => this.cache.has(d));
  }

  clear(): void {
    this.cache.clear();
  }
}
