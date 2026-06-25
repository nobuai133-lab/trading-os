'use client';

import { create } from 'zustand';
import type { DashboardState, Regime, PendingSetup, SetupStatus, Decision } from '@/types';
import { resolveAntiReentryDecision } from '@/lib/antiOvertrading';

interface AnalysisResult {
  price:   number;
  regime:  Regime;
  htfBias: string;
  setupA:  { status: SetupStatus; inZone: boolean; tp1Hit: boolean; tp2Hit: boolean; tp3Hit: boolean };
  setupB:  { status: SetupStatus; inZone: boolean };
}

interface TradeStore {
  state:         DashboardState | null;
  setState:      (s: DashboardState) => void;
  setPrice:      (price: number) => void;
  applyAnalysis: (result: AnalysisResult) => void;
}

export const useTradeStore = create<TradeStore>((set) => ({
  state:    null,

  setState: (s) => set({ state: s }),

  setPrice: (price) =>
    set((s) => ({ state: s.state ? { ...s.state, price } : null })),

  applyAnalysis: (result) =>
    set((s) => {
      if (!s.state) return {};
      const prev = s.state;

      // Update pending setups with live status from analysis
      const pendingSetups: PendingSetup[] | undefined = prev.pendingSetups?.map((setup) => {
        if (setup.id === 'A') {
          return {
            ...setup,
            status: result.setupA.status,
            inZone: result.setupA.inZone,
          };
        }
        if (setup.id === 'B') {
          return {
            ...setup,
            status: result.setupB.status,
            inZone: result.setupB.inZone,
          };
        }
        return setup;
      });

      // Re-evaluate the CIO decision if anti-reentry is active.
      let decision: Decision = prev.decision;
      if (prev.antiReentry?.blocked) {
        const resolved = resolveAntiReentryDecision(prev.antiReentry, prev.decision);
        decision = resolved.decision;
      }

      return {
        state: {
          ...prev,
          price:        result.price,
          regime:       result.regime,
          htfBias:      result.htfBias,
          decision,
          pendingSetups,
        },
      };
    }),
}));

export type TabName = 'scanner' | 'active' | 'risk' | 'review';

interface UIStore {
  activeTab:    TabName;
  setActiveTab: (tab: TabName) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeTab:    'scanner',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
