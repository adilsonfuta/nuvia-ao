import AuthForm from '../lib/auth-form';
export const metadata = { title: 'Entrar', robots: { index: false, follow: false } };
export default function LoginPage(){return <AuthForm mode="login"/>}
