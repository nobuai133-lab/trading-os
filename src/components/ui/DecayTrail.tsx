'use client';

import { motion } from 'framer-motion';
import type { DecayEvent } from '@/types';
import { confColor } from '@/lib/utils';

interface Props {
  events: DecayEvent[];
}

export default function DecayTrail({ events }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {events.map((ev, i) => {
        const color = confColor(ev.conf);
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
            className="flex items-center gap-2"
          >
            {/* Label */}
            <div className="w-[120px] shrink-0">
              <span className="text-[10px] text-muted leading-tight">{ev.label}</span>
            </div>

            {/* Bar */}
            <div
              className="flex-1 h-[5px] rounded-full overflow-hidden"
              style={{ background: 'rgba(71,85,105,0.25)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${ev.conf}%` }}
                transition={{ delay: i * 0.08 + 0.1, duration: 0.5, ease: 'easeOut' }}
              />
            </div>

            {/* Score + delta */}
            <div className="w-14 shrink-0 flex items-center justify-end gap-1">
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color }}
              >
                {ev.conf}
              </span>
              {ev.delta !== undefined && (
                <span
                  className="text-[9px] font-semibold"
                  style={{ color: ev.delta < 0 ? '#FF3B5C' : '#00E5A8' }}
                >
                  {ev.delta > 0 ? '+' : ''}{ev.delta}
                </span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
