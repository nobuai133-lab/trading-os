'use client';

import { useUIStore, type TabName } from '@/store';

const TABS: { id: TabName; icon: string; label: string }[] = [
  { id: 'scanner', icon: '◎', label: 'Scanner' },
  { id: 'active',  icon: '⊕', label: 'Active'  },
  { id: 'risk',    icon: '⚡', label: 'Risk'    },
  { id: 'review',  icon: '✦', label: 'Review'  },
];

export default function BottomNav() {
  const { activeTab, setActiveTab } = useUIStore();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
      style={{
        background:           'rgba(7,10,15,0.95)',
        backdropFilter:       'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop:            '1px solid rgba(255,255,255,0.06)',
        paddingBottom:        'env(safe-area-inset-bottom, 0px)',
        height:               '72px',
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 relative min-h-[44px]"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            {isActive && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full"
                style={{ background: '#38BDF8' }}
              />
            )}
            <span
              className="text-[16px] leading-none"
              style={{ color: isActive ? '#38BDF8' : '#475569' }}
            >
              {tab.icon}
            </span>
            <span
              className="text-[9px] font-semibold tracking-wider uppercase"
              style={{ color: isActive ? '#38BDF8' : '#475569' }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
