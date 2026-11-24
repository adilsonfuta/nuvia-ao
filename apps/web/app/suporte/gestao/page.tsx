import { redirect } from 'next/navigation';

export const metadata = { title: 'Pedidos de suporte', robots: { index: false, follow: false } };

export default function SupportManagementRedirect() {
  redirect('/admin?tab=support');
}
