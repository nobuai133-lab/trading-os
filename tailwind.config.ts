import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:     '#070A0F',
        green:  '#00E5A8',
        red:    '#FF3B5C',
        amber:  '#FBBF24',
        blue:   '#38BDF8',
        purple: '#A78BFA',
        gray:   '#64748B',
        text:   '#F8FAFC',
        muted:  '#94A3B8',
        muted2: '#475569',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card:  '14px',
        badge: '8px',
        chip:  '6px',
      },
      backdropBlur: {
        card: '20px',
      },
    },
  },
  plugins: [],
};

export default config;
