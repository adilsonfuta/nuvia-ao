import "server-only";

const apiOrigin = (process.env.API_INTERNAL_URL || "http://127.0.0.1:4000/api/v1").replace(/\/$/, "");

export async function getPublicApi<T>(path: string): Promise<T | null> {
  const response = await fetch(`${apiOrigin}${path.startsWith("/") ? path : `/${path}`}`, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Public API returned HTTP ${response.status} for ${path}`);
  return response.json() as Promise<T>;
}

export const publicSiteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === "production" ? "https://nuvia.sirius.ao" : "http://localhost:3000")).replace(/\/$/, "");

export function jsonLd(value: Record<string, unknown>) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
