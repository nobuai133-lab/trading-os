'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AlertMessage, AlertType } from '@/types';

const TYPE_STYLES: Record<AlertType, { bg: string; border: string; text: string; icon: string }> = {
  warn:    { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.30)',  text: '#FBBF24', icon: '⚠' },
  danger:  { bg: 'rgba(255,59,92,0.12)',   border: 'rgba(255,59,92,0.30)',   text: '#FF3B5C', icon: '✕' },
  success: { bg: 'rgba(0,229,168,0.12)',   border: 'rgba(0,229,168,0.30)',   text: '#00E5A8', icon: '✓' },
};

interface Props {
  message: AlertMessage | null;
}

export default function AlertBanner({ message }: Props) {
  const [dismissedText, setDismissedText] = useState<string | null>(null);

  const show = !!message && dismissedText !== message.text;

  return (
    <AnimatePresence>
      {show && message && (
        <motion.div
          key={message.text}
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{ y: -60,    opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          className="fixed left-0 right-0 z-[1000] flex items-center px-4 gap-2"
          style={{
            top:          'env(safe-area-inset-top, 0px)',
            paddingTop:   8,
            paddingBottom: 8,
            background:   TYPE_STYLES[message.type].bg,
            borderBottom: `1px solid ${TYPE_STYLES[message.type].border}`,
            backdropFilter:       'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <span
            className="text-[12px] font-bold shrink-0"
            style={{ color: TYPE_STYLES[message.type].text }}
          >
            {TYPE_STYLES[message.type].icon}
          </span>
          <span
            className="text-[11px] font-medium flex-1 leading-tight"
            style={{ color: TYPE_STYLES[message.type].text }}
          >
            {message.text}
          </span>
          <button
            onClick={() => setDismissedText(message.text)}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold"
            style={{
              color:      TYPE_STYLES[message.type].text,
              background: `${TYPE_STYLES[message.type].text}18`,
              border:     'none',
              cursor:     'pointer',
            }}
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
