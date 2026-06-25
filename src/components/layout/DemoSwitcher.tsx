'use client';

import { useTradeStore } from '@/store';
import { SCENARIOS } from '@/data/scenarios';

const SCENARIO_LABELS: { key: string; label: string }[] = [
  { key: 'active', label: 'TP1 Active'    },
  { key: 'setup',  label: 'New Setup'     },
  { key: 'tp3',    label: 'TP3 Complete'  },
  { key: 'sl',     label: 'SL Hit'        },
  { key: 'idle',   label: 'No Trade'      },
];

export default function DemoSwitcher() {
  const setState = useTradeStore((s) => s.setState);

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 overflow-x-auto"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <span className="text-[9px] font-bold tracking-widest uppercase text-muted2 shrink-0">
        Demo
      </span>
      {SCENARIO_LABELS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setState(SCENARIOS[key])}
          className="shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-chip transition-all"
          style={{
            background: 'rgba(71,85,105,0.15)',
            border:     '1px solid rgba(71,85,105,0.3)',
            color:      '#64748B',
            cursor:     'pointer',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
