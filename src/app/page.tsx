'use client';

import { useEffect } from 'react';
import { useTradeStore, useUIStore } from '@/store';
import { SCENARIOS } from '@/data/scenarios';
import { useLiveFeed } from '@/hooks/useLiveFeed';

import AlertBanner    from '@/components/layout/AlertBanner';
import StickyHeader   from '@/components/layout/StickyHeader';
import BottomNav      from '@/components/layout/BottomNav';

import ScannerPanel      from '@/components/dashboard/ScannerPanel';
import ActiveTradePanel  from '@/components/dashboard/ActiveTradePanel';
import RiskPanel         from '@/components/dashboard/RiskPanel';
import PostTradeReview   from '@/components/dashboard/PostTradeReview';

export default function Home() {
  const { state, setState } = useTradeStore();
  const { activeTab }       = useUIStore();

  useLiveFeed();

  useEffect(() => {
    setState(SCENARIOS.setup);
  }, []);

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-muted text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <>
      <AlertBanner message={state.alertMessage} />
      <StickyHeader state={state} />

      <div style={{ height: 56 }} />

      <div className="px-3 pt-2 pb-24 md:pb-4 max-w-[1400px] mx-auto">

        {/* ── Mobile: 4-tab panels ── */}
        <div className="md:hidden mt-2">
          {activeTab === 'scanner' && <ScannerPanel     state={state} />}
          {activeTab === 'active'  && <ActiveTradePanel state={state} />}
          {activeTab === 'risk'    && <RiskPanel         state={state} />}
          {activeTab === 'review'  && <PostTradeReview   state={state} />}
        </div>

        {/* ── Tablet: 2-col split — Scanner | Active ── */}
        <div className="hidden md:grid lg:hidden grid-cols-2 gap-3 mt-2">
          <ScannerPanel state={state} />
          <div className="space-y-3">
            <ActiveTradePanel state={state} />
            <RiskPanel        state={state} />
          </div>
        </div>

        {/* ── Desktop: 3-col split — Scanner | Active | Risk+Review ── */}
        <div className="hidden lg:grid grid-cols-[1.1fr_1fr_1fr] gap-3 mt-2">
          <ScannerPanel state={state} />
          <ActiveTradePanel state={state} />
          <div className="space-y-3">
            <RiskPanel        state={state} />
            <PostTradeReview  state={state} />
          </div>
        </div>
      </div>

      <BottomNav />
    </>
  );
}
