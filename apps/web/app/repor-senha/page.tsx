import PasswordRecoveryForm from "../lib/password-recovery-form";

export const metadata = { title: "Nova palavra-passe | Nuvia" };

export default function ResetPasswordPage() {
  return <PasswordRecoveryForm mode="reset" />;
}
