import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "./db";
import type { PlayerRow } from "./db/types";

export { hashPassword, verifyPassword } from "./crypto";

const COOKIE = "gt_session";
const MAX_AGE = 60 * 60 * 24 * 90; // 90 days: players stay signed in for the whole tour

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production");
  return s ?? "dev-only-secret-change-me";
}

const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

export async function startSession(playerId: string) {
  const jar = await cookies();
  jar.set(COOKIE, `${playerId}.${sign(playerId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in player, looked up once per request (layout and page share the result). */
export const getViewer = cache(async (): Promise<PlayerRow | null> => {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  const id = raw.slice(0, dot);
  const sig = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(sign(id));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  const db = await getDb();
  return (await db.selectFrom("players").selectAll().where("id", "=", id).executeTakeFirst()) ?? null;
});

export async function requireViewer(): Promise<PlayerRow> {
  const v = await getViewer();
  if (!v) redirect("/login");
  return v;
}

export async function requireOrganizer(): Promise<PlayerRow> {
  const v = await requireViewer();
  if (!v.is_organizer) redirect("/");
  return v;
}
