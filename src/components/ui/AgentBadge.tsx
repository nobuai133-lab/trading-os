'use client';

import type { AgentReport, AgentType } from '@/types';
import { cn } from '@/lib/utils';

const TYPE_STYLES: Record<AgentType, { bg: string; text: string; border: string }> = {
  bearish: { bg: 'rgba(255,59,92,0.10)',  text: '#FF3B5C', border: 'rgba(255,59,92,0.20)'  },
  bullish: { bg: 'rgba(0,229,168,0.10)',  text: '#00E5A8', border: 'rgba(0,229,168,0.20)'  },
  valid:   { bg: 'rgba(0,229,168,0.08)',  text: '#00E5A8', border: 'rgba(0,229,168,0.18)'  },
  warning: { bg: 'rgba(251,191,36,0.10)', text: '#FBBF24', border: 'rgba(251,191,36,0.22)' },
  neutral: { bg: 'rgba(100,116,139,0.12)',text: '#94A3B8', border: 'rgba(100,116,139,0.22)'},
  invalid: { bg: 'rgba(255,59,92,0.10)',  text: '#FF3B5C', border: 'rgba(255,59,92,0.20)'  },
};

interface Props {
  agent: AgentReport;
}

export default function AgentBadge({ agent }: Props) {
  const s = TYPE_STYLES[agent.type];

  return (
    <div
      className="rounded-badge px-2 py-[6px] flex flex-col gap-0.5"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: '#475569' }}>
        {agent.id}
      </span>
      <span className="text-[10px] font-semibold leading-tight" style={{ color: s.text }}>
        {agent.status}
      </span>
    </div>
  );
}
