import "server-only";
import { headers } from "next/headers";

/**
 * Public base URL used to build shareable invite links.
 *
 * Priority:
 *  1. APP_URL environment variable (set in production via deploy.env)
 *  2. Request host headers (correct on Cloud Run; localhost in dev)
 *
 * In local dev, APP_URL is typically unset and the fallback produces
 * http://localhost:3000 — which is correct for local browsing but NOT
 * shareable.  Set APP_URL in .env.local (e.g. to your LAN IP or ngrok
 * URL) to test invite links end-to-end.
 */
export async function appUrl(): Promise<string> {
  if (process.env.APP_URL) {
    const url = process.env.APP_URL.replace(/\/$/, "");
    if (process.env.NODE_ENV === "production" && /localhost/i.test(url)) {
      console.warn(
        `[appUrl] APP_URL is set to "${url}" but contains "localhost" — ` +
        "invite links will not be reachable outside this machine."
      );
    }
    return url;
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}`;
  if (process.env.NODE_ENV === "production" && /localhost/i.test(url)) {
    console.warn(
      `[appUrl] Host header resolved to "${url}", which contains "localhost". ` +
      "Set APP_URL env var so invite links are globally reachable."
    );
  }
  return url;
}