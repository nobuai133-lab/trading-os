'use client';

import { motion } from 'framer-motion';
import type { DecayEvent } from '@/types';
import { confColor } from '@/lib/utils';

const RADIUS        = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 238.76

interface Props {
  value:       number;
  decayEvents: DecayEvent[];
}

export default function ConfidenceRing({ value, decayEvents }: Props) {
  const offset = CIRCUMFERENCE * (1 - value / 100);
  const color  = confColor(value);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Ring */}
      <div className="relative flex items-center justify-center">
        <svg width="96" height="96" viewBox="0 0 96 96">
          {/* Track */}
          <circle
            cx="48"
            cy="48"
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="7"
          />
          {/* Animated fill */}
          <motion.circle
            cx="48"
            cy="48"
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            transform="rotate(-90 48 48)"
            style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-[22px] font-bold leading-none tabular-nums"
            style={{ color }}
          >
            {value}
          </span>
          <span className="text-[9px] font-semibold tracking-widest text-muted mt-0.5">
            CONF
          </span>
        </div>
      </div>

      {/* Decay trail */}
      {decayEvents.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap justify-center">
          {decayEvents.map((ev, i) => (
            <span key={i} className="flex items-center gap-1">
              <span
                className="text-[11px] font-semibold tabular-nums"
                style={{
                  color: i === decayEvents.length - 1
                    ? '#FBBF24'
                    : confColor(ev.conf),
                }}
              >
                {ev.conf}
              </span>
              {i < decayEvents.length - 1 && (
                <span className="text-[10px] text-muted2">→</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
