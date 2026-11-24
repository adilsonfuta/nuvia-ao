import AuthForm from '../lib/auth-form';
export const metadata = { title: 'Criar conta', robots: { index: false, follow: false } };
export default function RegisterPage(){return <AuthForm mode="register"/>}
