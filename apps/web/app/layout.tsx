import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Casar em Angola — Do sonho à realidade',
  description: 'Organiza casamentos, alambamentos e festas em Angola: planeia tarefas, orçamento, convidados e fornecedores.',
  openGraph: { title: 'Casar em Angola', description: 'Do sonho à realidade, com tudo organizado.', locale: 'pt_AO', type: 'website' }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-AO"><body>{children}</body></html>;
}
