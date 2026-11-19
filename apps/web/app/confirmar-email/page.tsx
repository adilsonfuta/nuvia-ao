import ConfirmEmailChange from "./confirm-email-change";

export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ConfirmEmailChange token={token || ""} />;
}
