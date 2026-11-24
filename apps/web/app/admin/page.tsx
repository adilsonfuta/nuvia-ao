import AdminConsole from './admin-console';
import './admin.css';
import './analytics.css';
import '../suporte/support.css';
import '../suporte/gestao/support-staff.css';
export const metadata={title:'Administração', robots:{index:false,follow:false}};
export default function AdminPage(){return <AdminConsole/>}
