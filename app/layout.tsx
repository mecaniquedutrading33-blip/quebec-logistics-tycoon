import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Canada City Builder',
  description: 'Construis ta ville canadienne, gère l\'économie et fais prospérer tes citoyens.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-[#0a0a0a] text-white antialiased">{children}</body>
    </html>
  );
}
