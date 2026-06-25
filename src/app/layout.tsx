import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title:       'Trading OS',
  description: 'Institutional trading dashboard',
  manifest:    '/manifest.json',
  other: {
    'apple-mobile-web-app-capable':           'yes',
    'apple-mobile-web-app-status-bar-style':  'black-translucent',
    'apple-mobile-web-app-title':             'Trading OS',
    'mobile-web-app-capable':                 'yes',
  },
};

export const viewport: Viewport = {
  width:               'device-width',
  initialScale:        1,
  viewportFit:         'cover',
  themeColor:          '#070A0F',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
