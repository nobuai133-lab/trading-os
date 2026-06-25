'use client';

import type { InvalidationLayers, InvStatus } from '@/types';

const STATUS_COLOR: Record<InvStatus, { border: string; text: string; bg: string }> = {
  VALID:   { border: '#00E5A8', text: '#00E5A8', bg: 'rgba(0,229,168,0.08)'  },
  WARNING: { border: '#FBBF24', text: '#FBBF24', bg: 'rgba(251,191,36,0.08)' },
  INVALID: { border: '#FF3B5C', text: '#FF3B5C', bg: 'rgba(255,59,92,0.08)'  },
};

const LAYER_ICONS: Record<string, string> = {
  price:     '◎',
  structure: '⬡',
  time:      '◷',
  thesis:    '◈',
};

const LAYER_NAMES: Record<string, string> = {
  price:     'Price',
  structure: 'Structure',
  time:      'Time',
  thesis:    'Thesis',
};

interface Props {
  layers: InvalidationLayers;
}

export default function InvalidationMatrix({ layers }: Props) {
  const keys = ['price', 'structure', 'time', 'thesis'] as const;

  return (
    <div className="grid grid-cols-2 gap-2">
      {keys.map((key) => {
        const layer = layers[key];
        const s     = STATUS_COLOR[layer.status];

        return (
          <div
            key={key}
            className="rounded-badge p-3 flex flex-col gap-1.5"
            style={{
              background: s.bg,
              border:     `1px solid ${s.border}40`,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] text-muted" style={{ fontSize: 13 }}>
                {LAYER_ICONS[key]}
              </span>
              <span className="text-[9px] font-semibold tracking-widest uppercase text-muted">
                {LAYER_NAMES[key]}
              </span>
              <span
                className="text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-sm"
                style={{
                  color:      s.text,
                  background: `${s.text}18`,
                  border:     `1px solid ${s.text}30`,
                }}
              >
                {layer.status}
              </span>
            </div>

            {/* Trigger */}
            <p className="text-[10px] font-semibold text-text leading-tight">
              {layer.trigger}
            </p>

            {/* Detail */}
            <p className="text-[9px] text-muted2 leading-snug">
              {layer.detail}
            </p>

            {/* Impact */}
            <p
              className="text-[9px] font-semibold"
              style={{ color: layer.status === 'VALID' ? '#64748B' : s.text }}
            >
              {layer.impact}
            </p>
          </div>
        );
      })}
    </div>
  );
}
