import { redirect } from 'next/navigation';

export const metadata = { title: 'Pedidos de suporte | Nuvia' };

export default function SupportManagementRedirect() {
  redirect('/admin?tab=support');
}
