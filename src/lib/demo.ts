import "server-only";
import { newId } from "./crypto";
import { getDb } from "./db";
import type { DemoRow } from "./db/types";
import { buildPlan, demoGross, hashString, mulberry32, type DemoAction, type DemoPlan } from "./demo-plan";
import { loadTour, type Tour } from "./tour";

/**
 * The in-app demo. There is no background worker (Cloud Run would freeze it):
 * every open phone calls tick(), which applies whatever steps of the stored
 * timeline are due. Each step is claimed by bumping the cursor first, so two
 * phones ticking at once never apply the same step twice.
 */

export const demoEnabled = () => process.env.DEMO_DISABLED !== "1";
export const SPEEDS = [0.5, 1, 2, 4];

export interface DemoStatus {
  running: boolean;
  finished: boolean;
  speed: number;
  cursor: number;
  total: number;
  /** recent activity, newest first */
  recent: string[];
  next: { moment: string; inSeconds: number } | null;
  /** set while the demo waits for a group that real players took over */
  waiting: string | null;
  /** real seconds until the demo ends at the current speed */
  remaining: number;
}

const nowIso = () => new Date().toISOString();

function clockOf(row: DemoRow, at = Date.now()) {
  return row.running_since ? row.clock + ((at - Date.parse(row.running_since)) / 1000) * row.speed : row.clock;
}

async function getRow(eventId: string) {
  const db = await getDb();
  return db.selectFrom("demo").selectAll().where("event_id", "=", eventId).executeTakeFirst();
}

export async function demoStatus(eventId: string): Promise<DemoStatus | null> {
  if (!demoEnabled()) return null;
  const row = await getRow(eventId);
  if (!row) return null;
  const plan = JSON.parse(row.plan) as DemoPlan;
  const clock = clockOf(row);
  const next = plan.actions.slice(row.cursor).find((a) => a.moment);
  const last = plan.actions.at(-1)!;
  return {
    running: !!row.running_since,
    finished: row.cursor >= plan.actions.length,
    speed: row.speed,
    cursor: row.cursor,
    total: plan.actions.length,
    recent: plan.actions.slice(Math.max(0, row.cursor - 6), row.cursor).reverse().map((a) => a.text),
    next: next ? { moment: next.moment!, inSeconds: Math.max(0, Math.round((next.t - clock) / row.speed)) } : null,
    waiting: await waitingFor(plan.actions[row.cursor], clock),
    remaining: Math.max(0, Math.round((last.t - clock) / row.speed)),
  };
}

/** Wipes the event's play (pairings, draws, scores, reveals) but keeps players, teams and courses. */
async function resetPlay(eventId: string) {
  const db = await getDb();
  const days = await db.selectFrom("days").select("id").where("event_id", "=", eventId).execute();
  if (!days.length) return;
  const sessions = await db.selectFrom("sessions").select("id").where("day_id", "in", days.map((d) => d.id)).execute();
  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length) {
    const matchIds = (await db.selectFrom("matches").select("id").where("session_id", "in", sessionIds).execute()).map((m) => m.id);
    if (matchIds.length) {
      await db.deleteFrom("score_log").where("match_id", "in", matchIds).execute();
      await db.deleteFrom("scores").where("match_id", "in", matchIds).execute();
    }
    await db.deleteFrom("matches").where("session_id", "in", sessionIds).execute();
    await db.deleteFrom("pairings").where("session_id", "in", sessionIds).execute();
    await db.updateTable("sessions").set({ status: "draft" }).where("id", "in", sessionIds).execute();
  }
  await db.updateTable("days").set({ revealed_at: null }).where("event_id", "=", eventId).execute();
}

export async function startDemo(eventId: string, speed: number) {
  const db = await getDb();
  await db.deleteFrom("demo").where("event_id", "=", eventId).execute();
  await resetPlay(eventId);
  const tour = await loadTour(eventId, null);
  const plan = buildPlan({
    seed: Date.now() % 2147483647,
    teams: tour.teams.map((t) => ({ id: t.id, name: t.name, players: tour.players.filter((p) => p.team_id === t.id) })),
    days: tour.days.map((d) => ({
      id: d.day.id,
      number: d.day.number,
      sessions: d.sessions.map((s) => ({
        id: s.session.id,
        slot: s.session.slot,
        format: s.session.format,
        played: s.played.map((h) => h.number),
        hidden: s.hidden,
      })),
    })),
  });
  await db
    .insertInto("demo")
    .values({ event_id: eventId, plan: JSON.stringify(plan), cursor: 0, clock: 0, running_since: nowIso(), speed: SPEEDS.includes(speed) ? speed : 1, started_at: nowIso() })
    .execute();
}

/** Banks the clock, then applies a change to running state or speed. */
async function retime(eventId: string, change: (row: DemoRow, clock: number) => Partial<DemoRow>) {
  const row = await getRow(eventId);
  if (!row) return;
  const db = await getDb();
  const clock = clockOf(row);
  await db
    .updateTable("demo")
    .set({ clock, running_since: row.running_since ? nowIso() : null, ...change(row, clock) })
    .where("event_id", "=", eventId)
    .execute();
}

export const pauseDemo = (eventId: string) => retime(eventId, () => ({ running_since: null }));
export const resumeDemo = (eventId: string) => retime(eventId, () => ({ running_since: nowIso() }));
export const setDemoSpeed = (eventId: string, speed: number) => retime(eventId, () => ({ speed: SPEEDS.includes(speed) ? speed : 1 }));

/**
 * Groups where a real player has saved a score: the simulated scorer leaves
 * those to them for the rest of the session.
 */
async function humanGroups(sessionId: string): Promise<Set<number>> {
  const db = await getDb();
  const matches = await db.selectFrom("matches").select(["id", "group_no"]).where("session_id", "=", sessionId).execute();
  if (!matches.length) return new Set();
  const rows = await db
    .selectFrom("score_log")
    .select("match_id")
    .distinct()
    .where("match_id", "in", matches.map((m) => m.id))
    .where("actor", "not like", "demo:%")
    .where("actor", "not like", "ruling:%")
    .execute();
  const ids = new Set(rows.map((r) => r.match_id));
  return new Set(matches.filter((m) => ids.has(m.id)).map((m) => m.group_no));
}

/** The session-complete step waits while a group real players took over is still out on the course. */
async function heldBy(sessionId: string): Promise<number | null> {
  const db = await getDb();
  const session = await db.selectFrom("sessions").select(["status", "day_id"]).where("id", "=", sessionId).executeTakeFirst();
  if (!session || session.status !== "live") return null;
  const humans = await humanGroups(sessionId);
  if (!humans.size) return null;
  const day = await db.selectFrom("days").select("event_id").where("id", "=", session.day_id).executeTakeFirstOrThrow();
  const s = (await loadTour(day.event_id, null)).sessions.find((x) => x.session.id === sessionId);
  const open = s?.matches.find((m) => humans.has(m.match.group_no) && m.completed < m.holes.length);
  return open ? open.match.group_no : null;
}

async function waitingFor(action: DemoAction | undefined, clock: number): Promise<string | null> {
  if (!action || action.kind !== "complete" || action.t > clock) return null;
  const group = await heldBy(action.session);
  return group ? `Waiting for group ${group} to finish their card` : null;
}

/** Jumps the clock to the next highlighted moment and plays everything up to it. */
export async function skipDemo(eventId: string) {
  await retime(eventId, (row, clock) => {
    const plan = JSON.parse(row.plan) as DemoPlan;
    const next = plan.actions.slice(row.cursor).find((a) => a.moment);
    return { clock: next ? Math.max(clock, next.t) : clock };
  });
  return tickDemo(eventId, true);
}

export async function stopDemo(eventId: string) {
  const db = await getDb();
  await db.deleteFrom("demo").where("event_id", "=", eventId).execute();
}

/** Applies every due step. Returns how many this call applied. */
export async function tickDemo(eventId: string, force = false): Promise<number> {
  if (!demoEnabled()) return 0;
  const db = await getDb();
  let row = await getRow(eventId);
  if (!row) return 0;
  const plan = JSON.parse(row.plan) as DemoPlan;
  const clock = clockOf(row);
  let applied = 0;
  let tour: Tour | null = null;
  const getTour = async () => (tour ??= await loadTour(eventId, null));

  while (row && row.cursor < plan.actions.length && plan.actions[row.cursor].t <= clock) {
    const i = row.cursor;
    const due = plan.actions[i];
    if (due.kind === "complete" && !force && (await heldBy(due.session))) {
      // hold demo time here until the group is done (Skip forces past it)
      await db.updateTable("demo").set({ clock: due.t, running_since: row.running_since ? nowIso() : null }).where("event_id", "=", eventId).execute();
      break;
    }
    force = false;
    const claim = await db.updateTable("demo").set({ cursor: i + 1 }).where("event_id", "=", eventId).where("cursor", "=", i).executeTakeFirst();
    if (Number(claim.numUpdatedRows) === 1) {
      const action = plan.actions[i];
      // one bad step (e.g. the organizer edited the draw mid-demo) shouldn't stall the rest
      await apply(action, plan.seed, getTour).catch((e) => console.error("demo step failed", action.kind, e));
      if (action.kind === "submit" || action.kind === "publish") tour = null;
      applied++;
    }
    row = await getRow(eventId);
  }
  return applied;
}

async function apply(a: DemoAction, seed: number, getTour: () => Promise<Tour>) {
  const db = await getDb();
  const ts = nowIso();
  switch (a.kind) {
    case "open":
      await db.updateTable("sessions").set({ status: "pairing" }).where("id", "=", a.session).execute();
      return;
    case "submit": {
      const team = (await getTour()).teams[a.team];
      await db.deleteFrom("pairings").where("session_id", "=", a.session).where("team_id", "=", team.id).execute();
      await db
        .insertInto("pairings")
        .values(a.slots.map((ids, i) => ({ id: newId(), session_id: a.session, team_id: team.id, slot: i + 1, player1_id: ids[0], player2_id: ids[1] ?? null, submitted_at: ts })))
        .execute();
      return;
    }
    case "publish": {
      const tour = await getTour();
      const s = tour.sessions.find((x) => x.session.id === a.session)!;
      const bySlot = (team: number, slot: number) => s.pairings.find((p) => p.team_id === tour.teams[team].id && p.slot === slot);
      const rows = [];
      for (let i = 1; bySlot(0, i) && bySlot(1, i); i++) {
        const group = s.session.format === "singles" ? Math.ceil(i / 2) : i;
        rows.push({ id: newId(), session_id: a.session, group_no: group, match_no: i, pairing_a_id: bySlot(0, i)!.id, pairing_b_id: bySlot(1, i)!.id, scorer_id: a.scorers[group - 1] ?? null });
      }
      await db.deleteFrom("matches").where("session_id", "=", a.session).execute();
      if (rows.length) await db.insertInto("matches").values(rows).execute();
      await db.updateTable("sessions").set({ status: "live" }).where("id", "=", a.session).execute();
      return;
    }
    case "hole": {
      const tour = await getTour();
      const s = tour.sessions.find((x) => x.session.id === a.session);
      if (!s || s.session.status === "complete") return;
      if ((await humanGroups(a.session)).has(a.group)) return; // real players are keeping this card
      const group = s.matches.filter((x) => x.match.group_no === a.group);
      const members = group.flatMap((x) => [...x.sideA, ...x.sideB].flatMap((e) => e.players.map((p) => p.id)));
      const scorer = group[0]?.match.scorer_id ?? members[0];
      const other = members.find((id) => id !== scorer);
      for (const m of group) {
        const cell = m.holes.find((h) => h.number === a.hole);
        if (!cell) continue;
        const existing = new Set(
          (await db.selectFrom("scores").select("entity_id").where("match_id", "=", m.match.id).where("hole", "=", a.hole).execute()).map((r) => r.entity_id),
        );
        const sides = [
          m.sideA.map((e, i) => ({ e, received: cell.receivedA[i] })),
          m.sideB.map((e, i) => ({ e, received: cell.receivedB[i] })),
        ];
        for (const side of sides) {
          const strokes = side.map(({ e, received }) => {
            const rand = mulberry32(hashString(`${seed}|${m.match.id}|${e.id}|${a.hole}`));
            return demoGross(rand, cell.par, received, s.session.format === "better_ball");
          });
          // never let a whole side pick up
          if (!strokes.some((x) => x > 0)) strokes[strokes.length - 1] = cell.par + side.at(-1)!.received;
          for (const [j, { e }] of side.entries()) {
            if (existing.has(e.id)) continue; // a real scorer got there first
            await db
              .insertInto("scores")
              .values({ match_id: m.match.id, entity_id: e.id, hole: a.hole, strokes: strokes[j], updated_at: ts, updated_by: scorer })
              .onConflict((oc) => oc.columns(["match_id", "entity_id", "hole"]).doNothing())
              .execute();
            await db.insertInto("score_log").values({ id: newId(), match_id: m.match.id, entity_id: e.id, hole: a.hole, strokes: strokes[j], at: ts, actor: `demo:${scorer}` }).execute();
            // a second phone in the group remembers this one differently
            if (a.dispute && other && m === group[0] && side === sides[0] && j === 0) {
              await db.insertInto("score_log").values({ id: newId(), match_id: m.match.id, entity_id: e.id, hole: a.hole, strokes: strokes[j] + 1, at: ts, actor: `demo:${other}` }).execute();
            }
          }
        }
      }
      return;
    }
    case "complete":
      await db.updateTable("sessions").set({ status: "complete" }).where("id", "=", a.session).execute();
      return;
    case "reveal":
      await db.updateTable("days").set({ revealed_at: ts }).where("id", "=", a.day).execute();
      return;
    case "end":
      return;
  }
}
