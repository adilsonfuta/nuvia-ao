import type { Metadata } from "next";
import AlbumPage from "./album-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Álbum de evento",
  robots: { index: false, follow: false },
};

export default function PublicAlbumPage() {
  return <AlbumPage />;
}
