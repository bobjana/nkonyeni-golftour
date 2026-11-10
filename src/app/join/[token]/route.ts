import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/email";

const COOKIE = "gt_session";
const MAX_AGE = 60 * 60 * 24 * 90;

function sign(v: string) {
  const s = process.env.SESSION_SECRET ?? "dev-only-secret-change-me";
  return createHmac("sha256", s).update(v).digest("base64url");
}

function cookieHeader(playerId: string): string {
  const sig = sign(playerId);
  const sameSite = "lax";
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${playerId}.${sig}; HttpOnly; SameSite=${sameSite}${secure}; Max-Age=${MAX_AGE}; Path=/`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = await appUrl();
  const db = await getDb();
  const player = await db.selectFrom("players").selectAll().where("invite_token", "=", token).executeTakeFirst();
  if (!player) {
    // Invalid token — redirect to the login page with a hint
    return NextResponse.redirect(new URL("/login", base));
  }
  if (!player.joined_at) {
    await db.updateTable("players").set({ joined_at: new Date().toISOString() }).where("id", "=", player.id).execute();
  }
  // Set the session cookie and redirect to the app home
  const response = NextResponse.redirect(new URL("/", base));
  response.headers.set("Set-Cookie", cookieHeader(player.id));
  return response;
}