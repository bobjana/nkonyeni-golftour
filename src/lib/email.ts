import "server-only";
import { headers } from "next/headers";
import type { EventRow, PlayerRow, TeamRow } from "./db/types";

export async function appUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Sends the invite via Resend. Without RESEND_API_KEY (local dev) the link is
 * logged instead, and the organizer can copy it from the Teams screen.
 */
export async function sendInvite(player: PlayerRow, team: TeamRow, event: EventRow): Promise<{ sent: boolean; link: string; error?: string }> {
  const link = `${await appUrl()}/join/${player.invite_token}`;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[invite] ${player.email}: ${link}`);
    return { sent: false, link };
  }
  const from = process.env.EMAIL_FROM ?? "Nkonyeni Golf Tour <onboarding@resend.dev>";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#0B1F3A;color:#fff;border-radius:16px">
      <p style="color:#C9A227;letter-spacing:2px;font-weight:bold;margin:0 0 16px">NKONYENI GOLF TOUR</p>
      <h1 style="font-size:22px;margin:0 0 8px">You're in, ${esc(player.name.split(" ")[0])}!</h1>
      <p style="color:#C7D0DD;line-height:1.5">You've been picked to play for <b style="color:#fff">${esc(team.name)}</b> at ${esc(event.name)}.
      Tap below to open the app, then enter the event password from your organizer.</p>
      <p style="margin:24px 0"><a href="${link}" style="background:#C9A227;color:#0B1F3A;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold">Open the tour app</a></p>
      <p style="color:#C7D0DD;font-size:12px">Tip: add it to your home screen for one-tap access on the course.</p>
    </div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [player.email], subject: `Your invite: ${event.name}`, html }),
  });
  if (!res.ok) return { sent: false, link, error: `Resend ${res.status}: ${await res.text()}` };
  return { sent: true, link };
}
