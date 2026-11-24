import ConfirmAccountEmail from "./confirm-account-email";

export const metadata = { title: "Confirmar conta", robots: { index: false, follow: false } };

export default async function ConfirmAccountEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ConfirmAccountEmail token={token || ""} />;
}
