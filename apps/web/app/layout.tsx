import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nuvia — Eventos e celebrações em Angola',
  description: 'Organiza casamentos, alambamentos e festas em Angola. Planeia tarefas, orçamento, convidados e fornecedores com a Nuvia.',
  openGraph: { title: 'Nuvia — Eventos e celebrações em Angola', description: 'Planeia casamentos, alambamentos e festas num só lugar.', locale: 'pt_AO', type: 'website' },
  icons: { icon: '/brand/nuvia-mark.png', apple: '/brand/nuvia-mark.png' }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-AO"><body>{children}</body></html>;
}
