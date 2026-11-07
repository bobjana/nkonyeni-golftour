"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { newId } from "@/lib/crypto";
import { getDb } from "@/lib/db";

/** Saves one team's pairings for a session. Captains (or the organizer) only, until the draw is published. */
export async function submitPairings(sessionId: string, teamId: string, form: FormData) {
  const viewer = await requireViewer();
  const db = await getDb();
  const team = await db.selectFrom("teams").selectAll().where("id", "=", teamId).executeTakeFirstOrThrow();
  const back = `/captain/${sessionId}${viewer.is_organizer ? `?team=${teamId}` : ""}`;
  if (team.captain_id !== viewer.id && !viewer.is_organizer) redirect("/");
  const session = await db.selectFrom("sessions").selectAll().where("id", "=", sessionId).executeTakeFirstOrThrow();
  if (await db.selectFrom("matches").select("id").where("session_id", "=", sessionId).executeTakeFirst()) {
    redirect(`${back}${back.includes("?") ? "&" : "?"}error=published`);
  }
  const players = await db.selectFrom("players").select("id").where("team_id", "=", teamId).execute();
  const perSlot = session.format === "singles" ? 1 : 2;
  const slots = Math.floor(players.length / perSlot);
  const rows: { p1: string; p2: string | null }[] = [];
  for (let i = 1; i <= slots; i++) {
    const p1 = String(form.get(`s${i}p1`) ?? "");
    const p2 = perSlot === 2 ? String(form.get(`s${i}p2`) ?? "") : null;
    rows.push({ p1, p2 });
  }
  const used = rows.flatMap((r) => [r.p1, r.p2]).filter((x): x is string => x !== null);
  const valid = used.every((id) => players.some((p) => p.id === id)) && new Set(used).size === used.length;
  if (!valid) redirect(`${back}${back.includes("?") ? "&" : "?"}error=duplicate`);

  const at = new Date().toISOString();
  await db.deleteFrom("pairings").where("session_id", "=", sessionId).where("team_id", "=", teamId).execute();
  await db
    .insertInto("pairings")
    .values(rows.map((r, i) => ({ id: newId(), session_id: sessionId, team_id: teamId, slot: i + 1, player1_id: r.p1, player2_id: r.p2, submitted_at: at })))
    .execute();
  revalidatePath("/", "layout");
  redirect(`${back}${back.includes("?") ? "&" : "?"}saved=1`);
}
