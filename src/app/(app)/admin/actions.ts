"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword, requireOrganizer } from "@/lib/auth";
import { newId, newToken } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import type { Format } from "@/lib/db/types";
import { sendInvite } from "@/lib/email";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(f.get(k));
const done = (path: string) => {
  revalidatePath("/", "layout");
  redirect(path);
};

/** Every write checks the row belongs to the organizer's own event. */
async function guard() {
  const org = await requireOrganizer();
  return { org, db: await getDb() };
}

async function ownSession(sessionId: string, eventId: string) {
  const db = await getDb();
  const row = await db
    .selectFrom("sessions")
    .innerJoin("days", "days.id", "sessions.day_id")
    .selectAll("sessions")
    .where("sessions.id", "=", sessionId)
    .where("days.event_id", "=", eventId)
    .executeTakeFirst();
  if (!row) throw new Error("Session not found");
  return row;
}

// ── Event, days and sessions ────────────────────────────────────────────────

export async function updateEvent(form: FormData) {
  const { org, db } = await guard();
  const password = str(form, "password");
  await db
    .updateTable("events")
    .set({
      name: str(form, "name") || "Golf Tour",
      hidden_holes: Math.max(0, Math.min(9, num(form, "hidden_holes") || 0)),
      ...(password ? { password_hash: hashPassword(password) } : {}),
    })
    .where("id", "=", org.event_id)
    .execute();
  done("/admin?saved=event");
}

export async function addDay(form: FormData) {
  const { org, db } = await guard();
  const days = await db.selectFrom("days").select("number").where("event_id", "=", org.event_id).execute();
  await db
    .insertInto("days")
    .values({ id: newId(), event_id: org.event_id, number: days.length + 1, date: str(form, "date"), course_id: str(form, "course_id"), revealed_at: null })
    .execute();
  done("/admin");
}

export async function addSession(dayId: string, form: FormData) {
  const { org, db } = await guard();
  const day = await db.selectFrom("days").select("id").where("id", "=", dayId).where("event_id", "=", org.event_id).executeTakeFirstOrThrow();
  const id = newId();
  await db
    .insertInto("sessions")
    .values({
      id,
      day_id: day.id,
      slot: str(form, "slot") === "PM" ? "PM" : "AM",
      format: (str(form, "format") as Format) || "better_ball",
      holes: num(form, "holes") === 9 ? 9 : 18,
      nine: str(form, "nine") === "back" ? "back" : "front",
      tee_time: str(form, "tee_time") || "07:30",
      pairing_deadline: null,
      status: "draft",
    })
    .execute();
  done(`/admin/sessions/${id}`);
}

export async function updateSession(sessionId: string, form: FormData) {
  const { org, db } = await guard();
  await ownSession(sessionId, org.event_id);
  const hasMatches = await db.selectFrom("matches").select("id").where("session_id", "=", sessionId).executeTakeFirst();
  await db
    .updateTable("sessions")
    .set({
      ...(hasMatches ? {} : {
        format: (str(form, "format") as Format) || "better_ball",
        holes: num(form, "holes") === 9 ? 9 : 18,
        nine: str(form, "nine") === "back" ? "back" : "front",
        slot: str(form, "slot") === "PM" ? "PM" : "AM",
      }),
      tee_time: str(form, "tee_time") || "07:30",
      pairing_deadline: str(form, "pairing_deadline") || null,
    })
    .where("id", "=", sessionId)
    .execute();
  done(`/admin/sessions/${sessionId}?saved=1`);
}

export async function deleteSession(sessionId: string) {
  const { org, db } = await guard();
  await ownSession(sessionId, org.event_id);
  if (await db.selectFrom("matches").select("id").where("session_id", "=", sessionId).executeTakeFirst()) {
    redirect(`/admin/sessions/${sessionId}?error=has-draw`);
  }
  await db.deleteFrom("pairings").where("session_id", "=", sessionId).execute();
  await db.deleteFrom("sessions").where("id", "=", sessionId).execute();
  done("/admin");
}

export async function setSessionStatus(sessionId: string, status: "draft" | "pairing" | "live" | "complete") {
  const { org, db } = await guard();
  await ownSession(sessionId, org.event_id);
  await db.updateTable("sessions").set({ status }).where("id", "=", sessionId).execute();
  done(`/admin/sessions/${sessionId}`);
}

/**
 * Publishes the draw: one match per slot from the organizer's match-ups.
 * Pairs formats play one match per group; singles put two matches in a group.
 */
export async function publishDraw(sessionId: string, form: FormData) {
  const { org, db } = await guard();
  const session = await ownSession(sessionId, org.event_id);
  const pairings = await db.selectFrom("pairings").selectAll().where("session_id", "=", sessionId).execute();
  const teams = await db.selectFrom("teams").selectAll().where("event_id", "=", org.event_id).orderBy("sort").execute();
  const a = pairings.filter((p) => p.team_id === teams[0].id);
  const n = a.length;
  const rows = [];
  const usedB = new Set<string>();
  for (let i = 1; i <= n; i++) {
    const pa = str(form, `m${i}a`);
    const pb = str(form, `m${i}b`);
    const group = session.format === "singles" ? Math.ceil(i / 2) : i;
    const scorer = str(form, `g${group}scorer`) || null;
    if (!pairings.some((p) => p.id === pa && p.team_id === teams[0].id) || !pairings.some((p) => p.id === pb && p.team_id === teams[1].id) || usedB.has(pb)) {
      redirect(`/admin/sessions/${sessionId}?error=matchups`);
    }
    usedB.add(pb);
    rows.push({ id: newId(), session_id: sessionId, group_no: group, match_no: i, pairing_a_id: pa, pairing_b_id: pb, scorer_id: scorer });
  }
  if (!rows.length) redirect(`/admin/sessions/${sessionId}?error=no-pairings`);
  await db.deleteFrom("matches").where("session_id", "=", sessionId).execute();
  await db.insertInto("matches").values(rows).execute();
  await db.updateTable("sessions").set({ status: "live" }).where("id", "=", sessionId).execute();
  done(`/admin/sessions/${sessionId}?saved=published`);
}

export async function updateScorers(sessionId: string, form: FormData) {
  const { org, db } = await guard();
  await ownSession(sessionId, org.event_id);
  const matches = await db.selectFrom("matches").selectAll().where("session_id", "=", sessionId).execute();
  for (const m of matches) {
    await db.updateTable("matches").set({ scorer_id: str(form, `g${m.group_no}scorer`) || null }).where("id", "=", m.id).execute();
  }
  done(`/admin/sessions/${sessionId}?saved=1`);
}

export async function resetDraw(sessionId: string) {
  const { org, db } = await guard();
  await ownSession(sessionId, org.event_id);
  const matches = await db.selectFrom("matches").select("id").where("session_id", "=", sessionId).execute();
  if (matches.length && (await db.selectFrom("scores").select("match_id").where("match_id", "in", matches.map((m) => m.id)).executeTakeFirst())) {
    redirect(`/admin/sessions/${sessionId}?error=has-scores`);
  }
  await db.deleteFrom("matches").where("session_id", "=", sessionId).execute();
  await db.updateTable("sessions").set({ status: "pairing" }).where("id", "=", sessionId).execute();
  done(`/admin/sessions/${sessionId}`);
}

export async function setReveal(dayId: string, reveal: boolean) {
  const { org, db } = await guard();
  await db
    .updateTable("days")
    .set({ revealed_at: reveal ? new Date().toISOString() : null })
    .where("id", "=", dayId)
    .where("event_id", "=", org.event_id)
    .execute();
  done(`/admin/reveal?day=${dayId}`);
}

/** Settles a hole where group members' cards disagree: the chosen score counts. */
export async function resolveScore(matchId: string, entityId: string, hole: number, dayId: string, strokes: number) {
  const { org, db } = await guard();
  const match = await db.selectFrom("matches").select(["id", "session_id"]).where("id", "=", matchId).executeTakeFirstOrThrow();
  await ownSession(match.session_id, org.event_id);
  const at = new Date().toISOString();
  await db
    .insertInto("scores")
    .values({ match_id: matchId, entity_id: entityId, hole, strokes, updated_at: at, updated_by: org.id })
    .onConflict((oc) => oc.columns(["match_id", "entity_id", "hole"]).doUpdateSet({ strokes, updated_at: at, updated_by: org.id }))
    .execute();
  await db
    .insertInto("score_checks")
    .values({ match_id: matchId, entity_id: entityId, hole, strokes, resolved_by: org.id, resolved_at: at })
    .onConflict((oc) => oc.columns(["match_id", "entity_id", "hole"]).doUpdateSet({ strokes, resolved_by: org.id, resolved_at: at }))
    .execute();
  await db.insertInto("score_log").values({ id: newId(), match_id: matchId, entity_id: entityId, hole, strokes, at, actor: `ruling:${org.id}` }).execute();
  done(`/admin/reveal?day=${dayId}&saved=check`);
}

// ── Teams and players ───────────────────────────────────────────────────────

export async function updateTeam(teamId: string, form: FormData) {
  const { org, db } = await guard();
  await db
    .updateTable("teams")
    .set({ name: str(form, "name"), color: str(form, "color") || "#0b1f3a", captain_id: str(form, "captain_id") || null })
    .where("id", "=", teamId)
    .where("event_id", "=", org.event_id)
    .execute();
  done("/admin/teams?saved=1");
}

export async function savePlayer(teamId: string, playerId: string | null, form: FormData) {
  const { org, db } = await guard();
  const team = await db.selectFrom("teams").select("id").where("id", "=", teamId).where("event_id", "=", org.event_id).executeTakeFirstOrThrow();
  const values = {
    name: str(form, "name"),
    email: str(form, "email").toLowerCase(),
    handicap_index: Number(str(form, "handicap_index").replace(",", ".")) || 0,
    tee_id: str(form, "tee_id") || null,
    is_organizer: form.get("is_organizer") ? 1 : 0,
  };
  if (!values.name || !values.email) redirect("/admin/teams?error=missing");
  const clash = await db.selectFrom("players").select("id").where("event_id", "=", org.event_id).where("email", "=", values.email).executeTakeFirst();
  if (clash && clash.id !== playerId) redirect("/admin/teams?error=email");
  if (playerId) {
    // never let the last organizer remove their own access
    if (playerId === org.id) values.is_organizer = 1;
    await db.updateTable("players").set(values).where("id", "=", playerId).where("event_id", "=", org.event_id).execute();
  } else {
    await db
      .insertInto("players")
      .values({ id: newId(), event_id: org.event_id, team_id: team.id, ...values, invite_token: newToken(), invited_at: null, joined_at: null })
      .execute();
  }
  done("/admin/teams?saved=1");
}

export async function removePlayer(playerId: string) {
  const { org, db } = await guard();
  const used = await db
    .selectFrom("pairings")
    .select("id")
    .where((eb) => eb.or([eb("player1_id", "=", playerId), eb("player2_id", "=", playerId)]))
    .executeTakeFirst();
  if (used || playerId === org.id) redirect("/admin/teams?error=in-use");
  await db.updateTable("teams").set({ captain_id: null }).where("captain_id", "=", playerId).execute();
  await db.deleteFrom("players").where("id", "=", playerId).where("event_id", "=", org.event_id).execute();
  done("/admin/teams?saved=1");
}

/** Sends invites to one player, or to everyone not yet invited when playerId is null. */
export async function invite(playerId: string | null) {
  const { org, db } = await guard();
  const event = await db.selectFrom("events").selectAll().where("id", "=", org.event_id).executeTakeFirstOrThrow();
  const teams = await db.selectFrom("teams").selectAll().where("event_id", "=", org.event_id).execute();
  let q = db.selectFrom("players").selectAll().where("event_id", "=", org.event_id);
  q = playerId ? q.where("id", "=", playerId) : q.where("invited_at", "is", null);
  const players = await q.execute();
  let sent = 0;
  let failed = 0;
  for (const p of players) {
    const r = await sendInvite(p, teams.find((t) => t.id === p.team_id)!, event);
    if (r.error) {
      console.error(r.error);
      failed++;
      continue;
    }
    if (r.sent) sent++;
    await db.updateTable("players").set({ invited_at: new Date().toISOString() }).where("id", "=", p.id).execute();
  }
  done(`/admin/teams?invited=${sent}&failed=${failed}&total=${players.length}`);
}

// ── Courses ─────────────────────────────────────────────────────────────────

export async function addCourse(form: FormData) {
  const { org, db } = await guard();
  const id = newId();
  await db.insertInto("courses").values({ id, event_id: org.event_id, name: str(form, "name") || "New course" }).execute();
  const SI = [1, 3, 5, 7, 9, 11, 13, 15, 17, 2, 4, 6, 8, 10, 12, 14, 16, 18];
  await db.insertInto("holes").values(SI.map((si, i) => ({ course_id: id, number: i + 1, par: 4, si }))).execute();
  await db.insertInto("tees").values({ id: newId(), course_id: id, name: "Default", rating: 72, slope: 113, lengths: "[]", is_default: 1 }).execute();
  done(`/admin/courses?course=${id}`);
}

export async function saveCourse(courseId: string, form: FormData) {
  const { org, db } = await guard();
  await db.selectFrom("courses").select("id").where("id", "=", courseId).where("event_id", "=", org.event_id).executeTakeFirstOrThrow();
  const holes = Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: num(form, `par${i + 1}`), si: num(form, `si${i + 1}`) }));
  const sis = new Set(holes.map((h) => h.si));
  if (sis.size !== 18 || [...sis].some((s) => s < 1 || s > 18) || holes.some((h) => h.par < 3 || h.par > 6)) {
    redirect(`/admin/courses?course=${courseId}&error=holes`);
  }
  await db.updateTable("courses").set({ name: str(form, "name") }).where("id", "=", courseId).execute();
  for (const h of holes) {
    await db.updateTable("holes").set({ par: h.par, si: h.si }).where("course_id", "=", courseId).where("number", "=", h.number).execute();
  }
  const tees = await db.selectFrom("tees").selectAll().where("course_id", "=", courseId).execute();
  const def = str(form, "default_tee");
  for (const t of tees) {
    await db
      .updateTable("tees")
      .set({
        name: str(form, `tee_${t.id}_name`) || t.name,
        rating: Number(str(form, `tee_${t.id}_rating`).replace(",", ".")) || t.rating,
        slope: num(form, `tee_${t.id}_slope`) || t.slope,
        is_default: def === t.id ? 1 : 0,
      })
      .where("id", "=", t.id)
      .execute();
  }
  done(`/admin/courses?course=${courseId}&saved=1`);
}
