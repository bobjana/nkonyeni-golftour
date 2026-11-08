import "server-only";
import { getDb } from "./db";
import type {
  CourseRow,
  DayRow,
  EventRow,
  MatchRow,
  PairingRow,
  PlayerRow,
  ScoreRow,
  SessionRow,
  TeamRow,
  TeeRow,
} from "./db/types";
import {
  courseHandicap,
  hiddenHoleNumbers,
  holeWinner,
  matchStrokes,
  pointsFor,
  sessionHoleNumbers,
  strokesOnHole,
  type Hole,
  type HoleWinner,
} from "./scoring";

export interface CourseView {
  course: CourseRow;
  holes: Hole[];
  par: number;
  tees: TeeRow[];
  defaultTee: TeeRow | undefined;
}

export interface Entity {
  /** player id (better ball, singles) or pairing id (foursomes) */
  id: string;
  label: string;
  short: string;
  players: PlayerRow[];
  courseHcps: number[];
  strokes: number;
}

export interface HoleCell extends Hole {
  result: HoleWinner | null;
  /** hidden from this viewer until the day is revealed */
  locked: boolean;
  /** hole is one of the session's hidden holes (whether or not this viewer may see it) */
  hiddenHole: boolean;
  grossA: (number | undefined)[];
  grossB: (number | undefined)[];
  receivedA: number[];
  receivedB: number[];
}

export interface MatchView {
  match: MatchRow;
  pairingA: PairingRow;
  pairingB: PairingRow;
  sideA: Entity[];
  sideB: Entity[];
  holes: HoleCell[];
  /** points from holes this viewer can see */
  points: { a: number; b: number };
  /** holes completed that this viewer can see */
  thru: number;
  /** holes completed, including hidden ones */
  completed: number;
  canSeeHidden: boolean;
  scorer: PlayerRow | undefined;
}

export interface SessionView {
  session: SessionRow;
  day: DayRow;
  played: Hole[];
  hidden: number[];
  matches: MatchView[];
  points: { a: number; b: number };
  available: number;
  pairings: PairingRow[];
}

export interface DayView {
  day: DayRow;
  course: CourseView;
  sessions: SessionView[];
  points: { a: number; b: number };
}

export interface Tour {
  event: EventRow;
  teams: [TeamRow, TeamRow];
  players: PlayerRow[];
  playerById: Map<string, PlayerRow>;
  courses: CourseView[];
  days: DayView[];
  sessions: SessionView[];
  points: { a: number; b: number };
  available: number;
  viewer: PlayerRow | null;
}

const short = (p: PlayerRow) => {
  const parts = p.name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : p.name;
};
const first = (p: PlayerRow) => p.name.trim().split(/\s+/)[0];

export async function loadTour(eventId: string, viewer: PlayerRow | null): Promise<Tour> {
  const db = await getDb();

  // Independent reads run together: each round trip to a remote Postgres costs ~150ms.
  const [event, teamRows, players, courseRows, days] = await Promise.all([
    db.selectFrom("events").selectAll().where("id", "=", eventId).executeTakeFirstOrThrow(),
    db.selectFrom("teams").selectAll().where("event_id", "=", eventId).orderBy("sort").execute(),
    db.selectFrom("players").selectAll().where("event_id", "=", eventId).orderBy("name").execute(),
    db.selectFrom("courses").selectAll().where("event_id", "=", eventId).execute(),
    db.selectFrom("days").selectAll().where("event_id", "=", eventId).orderBy("number").execute(),
  ]);
  if (teamRows.length < 2) throw new Error("An event needs two teams");
  const teams = [teamRows[0], teamRows[1]] as [TeamRow, TeamRow];

  const courseIds = courseRows.map((c) => c.id);
  const dayIds = days.map((d) => d.id);
  const [tees, holeRows, sessions] = await Promise.all([
    courseIds.length ? db.selectFrom("tees").selectAll().where("course_id", "in", courseIds).execute() : [],
    courseIds.length
      ? db.selectFrom("holes").selectAll().where("course_id", "in", courseIds).orderBy("number").execute()
      : [],
    dayIds.length ? db.selectFrom("sessions").selectAll().where("day_id", "in", dayIds).execute() : [],
  ]);

  const sessionIds = sessions.map((s) => s.id);
  const [pairings, matches] = await Promise.all([
    sessionIds.length
      ? db.selectFrom("pairings").selectAll().where("session_id", "in", sessionIds).orderBy("slot").execute()
      : [],
    sessionIds.length
      ? db.selectFrom("matches").selectAll().where("session_id", "in", sessionIds).orderBy("match_no").execute()
      : [],
  ]);
  const matchIds = matches.map((m) => m.id);
  const scores = matchIds.length ? await db.selectFrom("scores").selectAll().where("match_id", "in", matchIds).execute() : [];

  const playerById = new Map(players.map((p) => [p.id, p]));
  const courses: CourseView[] = courseRows.map((course) => {
    const holes = holeRows.filter((h) => h.course_id === course.id).map(({ number, par, si }) => ({ number, par, si }));
    const ct = tees.filter((t) => t.course_id === course.id);
    return {
      course,
      holes,
      par: holes.reduce((a, h) => a + h.par, 0),
      tees: ct,
      defaultTee: ct.find((t) => t.is_default) ?? ct[0],
    };
  });
  const courseById = new Map(courses.map((c) => [c.course.id, c]));
  const scoreMap = new Map<string, ScoreRow>();
  for (const s of scores) scoreMap.set(`${s.match_id}|${s.entity_id}|${s.hole}`, s);

  const isOrganizer = !!viewer?.is_organizer;
  const slotOrder = { AM: 0, PM: 1 } as const;

  const dayViews: DayView[] = days.map((day) => {
    const course = courseById.get(day.course_id)!;
    const ch = (p: PlayerRow) => {
      const tee = course.tees.find((t) => t.id === p.tee_id) ?? course.defaultTee;
      return tee ? courseHandicap(p.handicap_index, tee, course.par) : Math.round(p.handicap_index);
    };
    const daySessions = sessions
      .filter((s) => s.day_id === day.id)
      .sort((a, b) => slotOrder[a.slot] - slotOrder[b.slot])
      .map((session): SessionView => {
        const nums = sessionHoleNumbers(session.holes, session.nine);
        const played = course.holes.filter((h) => nums.includes(h.number));
        const hidden = hiddenHoleNumbers(nums, event.hidden_holes);
        const sp = pairings.filter((p) => p.session_id === session.id);
        const sm = matches.filter((m) => m.session_id === session.id);

        const entitiesFor = (pairing: PairingRow): Entity[] => {
          const ps = [pairing.player1_id, pairing.player2_id]
            .filter((id): id is string => !!id)
            .map((id) => playerById.get(id)!)
            .filter(Boolean);
          if (session.format === "foursomes") {
            return [{
              id: pairing.id,
              label: ps.map((p) => p.name).join(" & "),
              short: ps.map(first).join(" & "),
              players: ps,
              courseHcps: ps.map(ch),
              strokes: 0,
            }];
          }
          return ps.map((p) => ({ id: p.id, label: p.name, short: short(p), players: [p], courseHcps: [ch(p)], strokes: 0 }));
        };

        const matchViews = sm.map((match): MatchView => {
          const pairingA = sp.find((p) => p.id === match.pairing_a_id)!;
          const pairingB = sp.find((p) => p.id === match.pairing_b_id)!;
          const sideA = entitiesFor(pairingA);
          const sideB = entitiesFor(pairingB);
          const all = [...sideA, ...sideB];
          const strokes = matchStrokes(session.format, all.map((e) => e.courseHcps), played.length);
          all.forEach((e, i) => (e.strokes = strokes[i]));

          // Everyone in the same group (and its scorer) may see the group's hidden holes.
          const groupMatches = sm.filter((m) => m.group_no === match.group_no);
          const groupPlayerIds = new Set<string>();
          for (const gm of groupMatches) {
            if (gm.scorer_id) groupPlayerIds.add(gm.scorer_id);
            for (const pid of [gm.pairing_a_id, gm.pairing_b_id]) {
              const pr = sp.find((p) => p.id === pid);
              if (pr) [pr.player1_id, pr.player2_id].forEach((id) => id && groupPlayerIds.add(id));
            }
          }
          const canSeeHidden = !!day.revealed_at || isOrganizer || (!!viewer && groupPlayerIds.has(viewer.id));

          let completed = 0;
          const holes: HoleCell[] = played.map((h) => {
            const g = (e: Entity) => scoreMap.get(`${match.id}|${e.id}|${h.number}`)?.strokes;
            const grossA = sideA.map(g);
            const grossB = sideB.map(g);
            const receivedA = sideA.map((e) => strokesOnHole(e.strokes, h, played));
            const receivedB = sideB.map((e) => strokesOnHole(e.strokes, h, played));
            const hiddenHole = hidden.includes(h.number);
            const locked = hiddenHole && !canSeeHidden;
            const result = holeWinner({ gross: grossA, received: receivedA }, { gross: grossB, received: receivedB });
            if (result) completed++;
            return locked
              ? { ...h, result: null, locked, hiddenHole, grossA: sideA.map(() => undefined), grossB: sideB.map(() => undefined), receivedA, receivedB }
              : { ...h, result, locked, hiddenHole, grossA, grossB, receivedA, receivedB };
          });
          const visible = holes.filter((c) => !c.locked);
          return {
            match,
            pairingA,
            pairingB,
            sideA,
            sideB,
            holes,
            points: pointsFor(visible.map((c) => c.result)),
            thru: visible.filter((c) => c.result).length,
            completed,
            canSeeHidden,
            scorer: match.scorer_id ? playerById.get(match.scorer_id) : undefined,
          };
        });

        const pts = matchViews.reduce((acc, m) => ({ a: acc.a + m.points.a, b: acc.b + m.points.b }), { a: 0, b: 0 });
        const perSession = session.format === "singles" ? Math.floor(players.length / 2) : Math.floor(players.length / 4);
        return {
          session,
          day,
          played,
          hidden,
          matches: matchViews,
          points: pts,
          available: (sm.length || perSession) * played.length,
          pairings: sp,
        };
      });
    const pts = daySessions.reduce((acc, s) => ({ a: acc.a + s.points.a, b: acc.b + s.points.b }), { a: 0, b: 0 });
    return { day, course, sessions: daySessions, points: pts };
  });

  const allSessions = dayViews.flatMap((d) => d.sessions);
  return {
    event,
    teams,
    players,
    playerById,
    courses,
    days: dayViews,
    sessions: allSessions,
    points: dayViews.reduce((acc, d) => ({ a: acc.a + d.points.a, b: acc.b + d.points.b }), { a: 0, b: 0 }),
    available: allSessions.reduce((a, s) => a + s.available, 0),
    viewer,
  };
}

/** The match group this player scores in a session, if any. */
export function scorerMatches(s: SessionView, playerId: string): MatchView[] {
  const mine = s.matches.find((m) => m.match.scorer_id === playerId);
  return mine ? s.matches.filter((m) => m.match.group_no === mine.match.group_no) : [];
}

export const playersOf = (m: MatchView) => [...m.sideA, ...m.sideB].flatMap((e) => e.players);
