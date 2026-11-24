import PasswordRecoveryForm from "../lib/password-recovery-form";

export const metadata = { title: "Nova palavra-passe", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return <PasswordRecoveryForm mode="reset" />;
}
