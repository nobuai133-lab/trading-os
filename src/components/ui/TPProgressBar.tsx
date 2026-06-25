'use client';

import { motion } from 'framer-motion';
import type { Trade } from '@/types';
import { fmt } from '@/lib/utils';

interface Props {
  trade:        Trade;
  currentPrice: number;
}

export default function TPProgressBar({ trade, currentPrice }: Props) {
  const { entry, tp1, tp2, tp3, tp1Hit, tp2Hit, tp3Hit, direction } = trade;

  if (!entry || !tp3) {
    return (
      <div className="text-center text-muted2 text-xs py-4">
        No active trade levels
      </div>
    );
  }

  const totalDist  = Math.abs(entry - tp3);
  const priceDist  = Math.abs(entry - currentPrice);
  const progressPct = Math.min(100, Math.max(0, (priceDist / totalDist) * 100));

  // Marker positions relative to bar
  const tp1Pct = Math.abs(entry - tp1) / totalDist * 100;
  const tp2Pct = Math.abs(entry - tp2) / totalDist * 100;

  const markers = [
    { label: 'ENTRY', price: entry,        pct: 0,      hit: true,   isEntry: true  },
    { label: 'TP1',   price: tp1,          pct: tp1Pct, hit: tp1Hit, isEntry: false },
    { label: 'TP2',   price: tp2,          pct: tp2Pct, hit: tp2Hit, isEntry: false },
    { label: 'TP3',   price: tp3,          pct: 100,    hit: tp3Hit, isEntry: false },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[10px] font-semibold tracking-widest uppercase text-muted mb-1">
        {direction === 'SHORT' ? 'Short' : 'Long'} Progress — {progressPct.toFixed(0)}% to TP3
      </div>

      {/* Bar */}
      <div className="relative">
        {/* Track */}
        <div
          className="relative h-2 rounded-full overflow-hidden"
          style={{ background: 'rgba(71,85,105,0.3)' }}
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: progressPct >= 100
                ? '#00E5A8'
                : `linear-gradient(90deg, #00E5A8, #FBBF24)`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>

        {/* Marker dots */}
        {markers.map((m) => (
          <div
            key={m.label}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            style={{ left: `${m.pct}%` }}
          >
            <div
              className="w-3 h-3 rounded-full border-2"
              style={{
                background: m.hit
                  ? '#00E5A8'
                  : m.pct <= progressPct
                  ? '#FBBF24'
                  : '#475569',
                borderColor: m.hit
                  ? '#00E5A8'
                  : m.pct <= progressPct
                  ? '#FBBF24'
                  : '#475569',
              }}
            />
          </div>
        ))}
      </div>

      {/* Labels */}
      <div className="relative h-8 mt-1">
        {markers.map((m) => (
          <div
            key={m.label}
            className="absolute flex flex-col items-center"
            style={{
              left:      `${m.pct}%`,
              transform: m.pct === 0
                ? 'translateX(0)'
                : m.pct === 100
                ? 'translateX(-100%)'
                : 'translateX(-50%)',
            }}
          >
            <span
              className="text-[9px] font-bold tracking-wider"
              style={{
                color: m.hit ? '#00E5A8' : m.pct <= progressPct ? '#FBBF24' : '#475569',
              }}
            >
              {m.label}
            </span>
            <span
              className="text-[9px] font-medium tabular-nums"
              style={{ color: '#64748B' }}
            >
              {fmt(m.price)}
            </span>
          </div>
        ))}
      </div>

      {/* Current price indicator */}
      <div className="flex items-center justify-between text-[10px] text-muted2">
        <span>Current</span>
        <span className="font-semibold text-text tabular-nums">{fmt(currentPrice)}</span>
      </div>
    </div>
  );
}
