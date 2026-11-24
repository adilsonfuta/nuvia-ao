import type { Metadata } from "next";
import EventSummaryPage from "./event-summary-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Resumo de evento",
  robots: { index: false, follow: false },
};

export default function PublicEventSummaryPage() {
  return <EventSummaryPage />;
}
