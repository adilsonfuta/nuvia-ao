import PasswordRecoveryForm from "../lib/password-recovery-form";

export const metadata = { title: "Recuperar palavra-passe | Nuvia" };

export default function PasswordRecoveryPage() {
  return <PasswordRecoveryForm mode="request" />;
}
