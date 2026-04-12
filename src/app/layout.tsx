import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Egg Monitoring Dashboard',
  description: 'Sistem monitoring telur dan kandang ayam berbasis IoT',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
