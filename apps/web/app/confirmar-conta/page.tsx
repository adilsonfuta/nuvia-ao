import ConfirmAccountEmail from "./confirm-account-email";

export default async function ConfirmAccountEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ConfirmAccountEmail token={token || ""} />;
}
