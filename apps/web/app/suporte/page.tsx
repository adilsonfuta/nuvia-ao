import SupportInbox from './support-inbox';
import './support.css';
import './support-user.css';

export const metadata = { title: 'Ajuda e suporte', robots: { index: false, follow: false } };

export default function SupportPage() {
  return <SupportInbox />;
}
