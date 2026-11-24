import ConfirmEmailChange from "./confirm-email-change";

export const metadata = { title: "Confirmar email", robots: { index: false, follow: false } };

export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ConfirmEmailChange token={token || ""} />;
}
