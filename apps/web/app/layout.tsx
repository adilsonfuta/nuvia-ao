import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ClarityTracking } from './components/clarity-tracking';
import './globals.css';

export const metadata: Metadata = {
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) } : {}),
  title: 'Nuvia — Eventos e celebrações em Angola',
  description: 'Organiza casamentos, alambamentos e festas em Angola. Planeia tarefas, orçamento, convidados e fornecedores com a Nuvia.',
  openGraph: { title: 'Nuvia — Eventos e celebrações em Angola', description: 'Planeia casamentos, alambamentos e festas num só lugar.', locale: 'pt_AO', type: 'website' },
  icons: { icon: '/brand/nuvia-mark.png', apple: '/brand/nuvia-mark.png' }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-AO"><body>{children}<Suspense fallback={null}><ClarityTracking /></Suspense></body></html>;
}
