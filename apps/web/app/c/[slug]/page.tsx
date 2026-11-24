import type { Metadata } from "next";
import InvitationPage from "./invitation-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Convite de evento",
  robots: { index: false, follow: false },
};

export default function PublicInvitationPage() {
  return <InvitationPage />;
}
