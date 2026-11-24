import PasswordRecoveryForm from "../lib/password-recovery-form";

export const metadata = { title: "Recuperar palavra-passe", robots: { index: false, follow: false } };

export default function PasswordRecoveryPage() {
  return <PasswordRecoveryForm mode="request" />;
}
