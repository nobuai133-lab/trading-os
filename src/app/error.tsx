'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', error);
  }, [error]);

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      minHeight:      '100vh',
      background:     '#070A0F',
      color:          '#FF3B5C',
      fontFamily:     'ui-monospace, monospace',
      padding:        '2rem',
      gap:            '0.75rem',
    }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Dashboard Error</h2>
      <p style={{ color: '#94A3B8', fontSize: '0.875rem', margin: 0, maxWidth: 480, textAlign: 'center' }}>
        {error.message || 'An unexpected client-side error occurred.'}
      </p>
      {error.digest && (
        <p style={{ color: '#475569', fontSize: '0.75rem', margin: 0 }}>
          digest: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        style={{
          marginTop:    '0.5rem',
          background:   'rgba(96,165,250,0.15)',
          color:        '#60A5FA',
          border:       '1px solid rgba(96,165,250,0.3)',
          padding:      '0.5rem 1.5rem',
          borderRadius: '0.375rem',
          cursor:       'pointer',
          fontSize:     '0.875rem',
        }}
      >
        Try again
      </button>
    </div>
  );
}
