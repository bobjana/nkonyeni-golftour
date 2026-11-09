"use server";

import { redirect } from "next/navigation";
import { startSession, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

export type LoginState = { error?: string };

const now = () => new Date().toISOString();

/** Sign in with email + shared event password (organizer bootstrap fallback). */
export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const db = await getDb();
  const player = await db.selectFrom("players").selectAll().where("email", "=", email).executeTakeFirst();
  if (!player) return { error: "We couldn't find that email on any tour. Check with your organizer." };
  const event = await db.selectFrom("events").select("password_hash").where("id", "=", player.event_id).executeTakeFirstOrThrow();
  if (!verifyPassword(password, event.password_hash)) return { error: "That event password isn't right." };
  if (!player.joined_at) await db.updateTable("players").set({ joined_at: now() }).where("id", "=", player.id).execute();
  await startSession(player.id);
  redirect("/");
}