'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { LIFECYCLE_STEPS } from '@/types';

interface Props {
  currentIndex: number;
}

export default function LifecycleStepper({ currentIndex }: Props) {
  const currentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentRef.current && containerRef.current) {
      currentRef.current.scrollIntoView({
        behavior: 'smooth',
        block:    'nearest',
        inline:   'center',
      });
    }
  }, [currentIndex]);

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto pb-1"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div className="flex items-start gap-0" style={{ minWidth: 'max-content' }}>
        {LIFECYCLE_STEPS.map((step, i) => {
          const isDone    = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isFuture  = i > currentIndex;

          return (
            <div key={step.key} className="flex items-start">
              {/* Step */}
              <div
                ref={isCurrent ? currentRef : undefined}
                className="flex flex-col items-center gap-1"
                style={{ minWidth: 44 }}
              >
                {/* Dot */}
                {isCurrent ? (
                  <motion.div
                    className="relative flex items-center justify-center rounded-full"
                    style={{
                      width:      22,
                      height:     22,
                      background: '#00E5A8',
                      boxShadow:  '0 0 12px rgba(0,229,168,0.5)',
                    }}
                    animate={{ boxShadow: ['0 0 8px rgba(0,229,168,0.4)', '0 0 18px rgba(0,229,168,0.7)', '0 0 8px rgba(0,229,168,0.4)'] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                  >
                    <span className="text-[9px] font-bold text-bg">{i}</span>
                  </motion.div>
                ) : isDone ? (
                  <div
                    className="rounded-full"
                    style={{ width: 10, height: 10, background: '#00E5A8', marginTop: 6 }}
                  />
                ) : (
                  <div
                    className="rounded-full"
                    style={{ width: 8, height: 8, background: '#475569', marginTop: 7, opacity: 0.4 }}
                  />
                )}
                {/* Label */}
                <span
                  className="text-[9px] font-medium text-center leading-none"
                  style={{
                    color:   isCurrent ? '#F8FAFC' : isDone ? '#00E5A8' : '#475569',
                    opacity: isFuture ? 0.4 : 1,
                  }}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line (not after last) */}
              {i < LIFECYCLE_STEPS.length - 1 && (
                <div
                  style={{
                    height:     2,
                    width:      24,
                    marginTop:  10,
                    background: isDone ? '#00E5A8' : 'rgba(71,85,105,0.4)',
                    borderRadius: 1,
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
