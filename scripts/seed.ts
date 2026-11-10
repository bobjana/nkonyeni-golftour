/**
 * Seeds the sample tour. Usage:
 *   npm run seed                 # empty DB → event, teams, players, course, days, sessions
 *   npm run seed -- --reset      # wipe all data first
 *   npm run seed -- --demo       # also play Day 1 (revealed) and half of Day 2 AM (live)
 * Env: DATABASE_URL, SEED_EVENT_PASSWORD (default tour2026), SEED_ORGANIZER_EMAIL.
 */
import { getDb } from "../src/lib/db";
import { hashPassword, newId, newToken } from "../src/lib/crypto";
import type { Database } from "../src/lib/db/types";

const args = new Set(process.argv.slice(2));
const now = () => new Date().toISOString();

// ── Royal Swazi Spa (Day 1) ────────────────────────────────────────────────
const PAR = [4, 4, 3, 4, 5, 3, 5, 4, 4, 4, 4, 5, 4, 3, 4, 4, 5, 3];
const SI = [18, 4, 8, 6, 10, 14, 2, 16, 12, 9, 1, 17, 7, 15, 5, 11, 3, 13];
const TEES = [
  { name: "White", rating: 72.5, slope: 137, lengths: [394, 428, 205, 386, 536, 187, 486, 386, 317, 303, 437, 504, 379, 195, 424, 408, 549, 191] },
  { name: "Blue", rating: 69.5, slope: 131, lengths: [364, 395, 175, 357, 507, 165, 433, 347, 290, 278, 372, 504, 352, 150, 413, 397, 478, 159], default: true },
  { name: "Red", rating: 66.4, slope: 121, lengths: [334, 366, 150, 280, 466, 157, 427, 302, 244, 272, 334, 453, 329, 109, 357, 363, 411, 150] },
];

// ── Nkonyeni (Day 2 & 3) — https://www.golfhandicapp.com/courses/nkonyeni ──
const NK_PAR = [4, 3, 4, 5, 4, 5, 3, 4, 3, 5, 3, 4, 4, 5, 4, 4, 4, 3];
// SI: 1 = hardest, 18 = easiest, estimated from yardage relative to par
const NK_SI = [9, 16, 6, 2, 13, 1, 8, 4, 18, 5, 14, 7, 17, 3, 15, 12, 11, 10];
const NK_TEES = [
  { name: "White", rating: 72.4, slope: 135, lengths: [387, 159, 436, 606, 384, 629, 171, 440, 138, 529, 167, 437, 307, 581, 349, 377, 378, 179], default: true },
  { name: "Blue", rating: 70.4, slope: 132, lengths: [380, 153, 403, 600, 377, 528, 144, 407, 128, 505, 160, 411, 280, 553, 327, 370, 372, 164] },
  { name: "White(w)", rating: 80.0, slope: 150, lengths: [387, 159, 436, 606, 384, 629, 171, 440, 138, 529, 167, 437, 307, 581, 349, 377, 378, 179] },
];

const TEAMS = [
  { name: "Business Elite", color: "#1D5BBF", players: [["Jan Viljoen", 18], ["Vernon", 15], ["Johny", 20], ["Owen", 26]] },
  { name: "Challenge", color: "#C8102E", players: [["Gerald", 21], ["Ras", 12], ["JP", 24], ["Deodat", 24]] },
] as const;

const DAYS = [
  { date: "2026-11-13", sessions: [{ slot: "PM", format: "better_ball", holes: 18, nine: "front", tee: "12:30" }] },
  { date: "2026-11-14", sessions: [
    { slot: "AM", format: "better_ball", holes: 18, nine: "front", tee: "07:30" },
    { slot: "PM", format: "foursomes", holes: 9, nine: "front", tee: "13:00" },
  ] },
  { date: "2026-11-15", sessions: [
    { slot: "AM", format: "singles", holes: 18, nine: "front", tee: "07:30" },
    { slot: "PM", format: "foursomes", holes: 9, nine: "back", tee: "13:00" },
  ] },
] as const;

const TABLES: (keyof Database)[] = ["score_checks", "score_log", "scores", "matches", "pairings", "sessions", "days", "holes", "tees", "courses", "players", "teams", "events"];

async function main() {
  const db = await getDb();
  if (args.has("--reset")) {
    for (const t of TABLES) await db.deleteFrom(t).execute();
    console.log("Wiped all tables.");
  }
  if (await db.selectFrom("events").select("id").executeTakeFirst()) {
    console.log("An event already exists; run with --reset to start over.");
    process.exit(0);
  }

  const password = process.env.SEED_EVENT_PASSWORD ?? "tour2026";
  const organizerEmail = (process.env.SEED_ORGANIZER_EMAIL ?? "organizer@example.com").toLowerCase();
  const eventId = newId();
  await db.insertInto("events").values({ id: eventId, name: "Nkonyeni Golf Tour 2026", password_hash: hashPassword(password), hidden_holes: 3, created_at: now() }).execute();

  const courseId1 = newId();
  await db.insertInto("courses").values({ id: courseId1, event_id: eventId, name: "Royal Swazi Spa" }).execute();
  await db.insertInto("holes").values(PAR.map((par, i) => ({ course_id: courseId1, number: i + 1, par, si: SI[i] }))).execute();
  await db.insertInto("tees").values(TEES.map((t) => ({ id: newId(), course_id: courseId1, name: t.name, rating: t.rating, slope: t.slope, lengths: JSON.stringify(t.lengths), is_default: "default" in t ? 1 : 0 }))).execute();

  const courseId2 = newId();
  await db.insertInto("courses").values({ id: courseId2, event_id: eventId, name: "Nkonyeni" }).execute();
  await db.insertInto("holes").values(NK_PAR.map((par, i) => ({ course_id: courseId2, number: i + 1, par, si: NK_SI[i] }))).execute();
  await db.insertInto("tees").values(NK_TEES.map((t) => ({ id: newId(), course_id: courseId2, name: t.name, rating: t.rating, slope: t.slope, lengths: JSON.stringify(t.lengths), is_default: "default" in t ? 1 : 0 }))).execute();

  const playerIds: string[][] = [];
  for (const [ti, team] of TEAMS.entries()) {
    const teamId = newId();
    await db.insertInto("teams").values({ id: teamId, event_id: eventId, name: team.name, color: team.color, captain_id: null, sort: ti }).execute();
    const ids: string[] = [];
    for (const [pi, [name, hi]] of team.players.entries()) {
      const id = newId();
      const isOrganizer = ti === 0 && pi === 0;
      const email = isOrganizer ? organizerEmail : `${name.split(" ")[0].toLowerCase()}@example.com`;
      await db.insertInto("players").values({ id, event_id: eventId, team_id: teamId, name, email, handicap_index: hi, tee_id: null, is_organizer: isOrganizer ? 1 : 0, invite_token: newToken(), invited_at: null, joined_at: null }).execute();
      ids.push(id);
    }
    await db.updateTable("teams").set({ captain_id: ids[0] }).where("id", "=", teamId).execute();
    playerIds.push(ids);
  }

  const courseForDay = [courseId1, courseId2, courseId2];
  const sessionIds: string[] = [];
  for (const [di, day] of DAYS.entries()) {
    const dayId = newId();
    await db.insertInto("days").values({ id: dayId, event_id: eventId, number: di + 1, date: day.date, course_id: courseForDay[di], revealed_at: null }).execute();
    for (const s of day.sessions) {
      const id = newId();
      await db.insertInto("sessions").values({ id, day_id: dayId, slot: s.slot, format: s.format, holes: s.holes, nine: s.nine, tee_time: s.tee, pairing_deadline: null, status: "draft" }).execute();
      sessionIds.push(id);
    }
  }

  if (args.has("--demo")) await demo(sessionIds, playerIds);

  console.log(`Seeded "Nkonyeni Golf Tour 2026". Organizer: ${organizerEmail} · event password: ${password}`);
  process.exit(0);
}

/** Plays Day 1 fully (revealed) and Day 2 AM partly, so the screens have data. */
async function demo(sessionIds: string[], [med, biz]: string[][]) {
  const db = await getDb();
  const ts = now();
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const days = await db.selectFrom("days").selectAll().orderBy("number").execute();

  async function setup(sessionId: string) {
    const pairs = [[med[0], med[1]], [med[2], med[3]], [biz[0], biz[1]], [biz[2], biz[3]]];
    const team = async (pid: string) => (await db.selectFrom("players").select("team_id").where("id", "=", pid).executeTakeFirstOrThrow()).team_id;
    const pIds: string[] = [];
    for (const [i, [a, b]] of pairs.entries()) {
      const id = newId();
      await db.insertInto("pairings").values({ id, session_id: sessionId, team_id: await team(a), slot: (i % 2) + 1, player1_id: a, player2_id: b, submitted_at: ts }).execute();
      pIds.push(id);
    }
    const m1 = newId();
    const m2 = newId();
    await db.insertInto("matches").values([
      { id: m1, session_id: sessionId, group_no: 1, match_no: 1, pairing_a_id: pIds[0], pairing_b_id: pIds[2], scorer_id: med[0] },
      { id: m2, session_id: sessionId, group_no: 2, match_no: 2, pairing_a_id: pIds[1], pairing_b_id: pIds[3], scorer_id: biz[2] },
    ]).execute();
    return [
      { id: m1, players: [med[0], med[1], biz[0], biz[1]] },
      { id: m2, players: [med[2], med[3], biz[2], biz[3]] },
    ];
  }
  const put = (match_id: string, entity_id: string, hole: number, strokes: number) =>
    db.insertInto("scores").values({ match_id, entity_id, hole, strokes, updated_at: ts, updated_by: "seed" }).execute();
  const randomGross = (hole: number, pars: number[]) => pars[hole - 1] + Math.floor(rand() * 3);

  // Day 1: complete and revealed (Royal Swazi Spa)
  for (const m of await setup(sessionIds[0])) for (let h = 1; h <= 18; h++) for (const p of m.players) await put(m.id, p, h, randomGross(h, PAR));
  await db.updateTable("sessions").set({ status: "complete" }).where("id", "=", sessionIds[0]).execute();
  await db.updateTable("days").set({ revealed_at: ts }).where("id", "=", days[0].id).execute();

  // Day 2 AM: live (Nkonyeni). Match 1 card thru 12; match 2 random thru 10.
  const [m1, m2] = await setup(sessionIds[1]);
  const card = [[4, 5, 5, 5], [5, 6, 4, 6], [3, 4, 3, 5], [5, 4, 4, 5], [5, 5, 5, 6], [4, 4, 3, 4], [5, 6, 5, 5], [5, 5, 4, 5], [4, 5, 5, 6], [5, 6, 4, 6], [5, 5, 5, 6], [5, 6, 5, 6]];
  for (const [i, row] of card.entries()) for (const [j, p] of m1.players.entries()) await put(m1.id, p, i + 1, row[j]);
  for (let h = 1; h <= 10; h++) for (const p of m2.players) await put(m2.id, p, h, randomGross(h, NK_PAR));
  await db.updateTable("sessions").set({ status: "live" }).where("id", "=", sessionIds[1]).execute();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
