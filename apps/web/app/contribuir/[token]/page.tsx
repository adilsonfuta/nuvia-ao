import type { Metadata } from "next";
import ContributionForm from "./contribution-form";

export const metadata: Metadata = {
  title: "Contribuir para um evento | Nuvia",
  robots: { index: false, follow: false },
};

export default function ContributionPage() {
  return <ContributionForm />;
}
