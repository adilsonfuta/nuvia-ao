import { createSign } from "node:crypto";
import { Controller, Get, Logger, Query, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import { AdminOnlyGuard, SessionGuard } from "./auth";

type GaRow = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };
type GaReport = { rows?: GaRow[]; metricHeaders?: { name?: string }[] };
type AnalyticsRange = "7d" | "28d" | "90d";

const logger = new Logger("AdminAnalytics");
const scope = "https://www.googleapis.com/auth/analytics.readonly";
let cachedToken: { value: string; expiresAt: number } | null = null;
const reportCache = new Map<AnalyticsRange, { value: unknown; expiresAt: number }>();

function b64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function analyticsConfig() {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  const email = process.env.GA4_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  return propertyId && email && privateKey ? { propertyId, email, privateKey } : null;
}

async function getAccessToken(config: NonNullable<ReturnType<typeof analyticsConfig>>) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: config.email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(config.privateKey, "base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Google OAuth returned ${response.status}`);
  const result = await response.json() as { access_token?: string; expires_in?: number };
  if (!result.access_token) throw new Error("Google OAuth returned no access token");
  cachedToken = { value: result.access_token, expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

async function runReport(
  propertyId: string,
  accessToken: string,
  range: AnalyticsRange,
  dimensions: string[],
  metrics: string[],
  limit = 100,
  sortByMetric = false,
) {
  const days = range === "7d" ? 6 : range === "28d" ? 27 : 89;
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      ...(dimensions.length ? { dimensions: dimensions.map((name) => ({ name })) } : {}),
      metrics: metrics.map((name) => ({ name })),
      ...(sortByMetric ? { orderBys: [{ metric: { metricName: metrics[0] }, desc: true }] } : {}),
      limit,
      keepEmptyRows: false,
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Google Analytics Data API returned ${response.status}`);
  return response.json() as Promise<GaReport>;
}

function values(row?: GaRow) {
  return (row?.metricValues ?? []).map((item) => Number(item.value ?? 0));
}

@Controller("admin/analytics")
@UseGuards(SessionGuard, AdminOnlyGuard)
export class AdminAnalyticsController {
  @Get()
  async getOverview(@Query("range") requestedRange?: string) {
    const range: AnalyticsRange = requestedRange === "7d" || requestedRange === "90d" ? requestedRange : "28d";
    const config = analyticsConfig();
    if (!config) return { configured: false as const, range };

    const cached = reportCache.get(range);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    try {
      const token = await getAccessToken(config);
      const [overview, daily, pages, channels] = await Promise.all([
        runReport(config.propertyId, token, range, [], ["activeUsers", "sessions", "screenPageViews", "engagementRate"], 1),
        runReport(config.propertyId, token, range, ["date"], ["activeUsers", "sessions", "screenPageViews"], 100),
        runReport(config.propertyId, token, range, ["pagePath"], ["screenPageViews", "activeUsers"], 8, true),
        runReport(config.propertyId, token, range, ["sessionDefaultChannelGroup"], ["sessions", "activeUsers"], 8, true),
      ]);

      const totals = values(overview.rows?.[0]);
      const result = {
        configured: true as const,
        range,
        updatedAt: new Date().toISOString(),
        totals: { activeUsers: totals[0] ?? 0, sessions: totals[1] ?? 0, pageViews: totals[2] ?? 0, engagementRate: totals[3] ?? 0 },
        daily: (daily.rows ?? []).map((row) => ({
          date: row.dimensionValues?.[0]?.value ?? "",
          activeUsers: values(row)[0] ?? 0,
          sessions: values(row)[1] ?? 0,
          pageViews: values(row)[2] ?? 0,
        })),
        pages: (pages.rows ?? []).map((row) => ({ path: row.dimensionValues?.[0]?.value ?? "—", pageViews: values(row)[0] ?? 0, activeUsers: values(row)[1] ?? 0 })),
        channels: (channels.rows ?? []).map((row) => ({ name: row.dimensionValues?.[0]?.value ?? "Não identificado", sessions: values(row)[0] ?? 0, activeUsers: values(row)[1] ?? 0 })),
      };
      reportCache.set(range, { value: result, expiresAt: Date.now() + 5 * 60_000 });
      return result;
    } catch (error) {
      logger.error("Failed to retrieve Google Analytics report", error instanceof Error ? error.stack : undefined);
      throw new ServiceUnavailableException("Não foi possível consultar o Google Analytics. Verifica a configuração e as permissões da propriedade GA4.");
    }
  }
}
