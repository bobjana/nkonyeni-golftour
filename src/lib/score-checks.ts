import "server-only";
import { findConflicts } from "./checks";
import { getDb } from "./db";
import type { Entity, MatchView, SessionView, Tour } from "./tour";

export interface DayConflict {
  session: SessionView;
  match: MatchView;
  entity: Entity;
  hole: number;
  /** the score that currently counts */
  counting: number | undefined;
  entries: { name: string; strokes: number; at: string }[];
}

/** Holes in a day's matches where group members' cards disagree and the organizer hasn't ruled. */
export async function dayConflicts(tour: Tour, dayId: string): Promise<DayConflict[]> {
  const sessions = tour.sessions.filter((s) => s.day.id === dayId);
  const matches = sessions.flatMap((s) => s.matches.map((m) => ({ s, m })));
  if (!matches.length) return [];
  const db = await getDb();
  const ids = matches.map(({ m }) => m.match.id);
  const log = await db.selectFrom("score_log").select(["match_id", "entity_id", "hole", "strokes", "at", "actor"]).where("match_id", "in", ids).execute();
  const checks = await db.selectFrom("score_checks").selectAll().where("match_id", "in", ids).execute();
  const out: DayConflict[] = [];
  for (const c of findConflicts(log, checks)) {
    const found = matches.find(({ m }) => m.match.id === c.matchId);
    if (!found) continue;
    const { s, m } = found;
    const sideAt = m.sideA.findIndex((e) => e.id === c.entityId);
    const entity = sideAt >= 0 ? m.sideA[sideAt] : m.sideB.find((e) => e.id === c.entityId);
    const cell = m.holes.find((h) => h.number === c.hole);
    if (!entity || !cell) continue;
    const counting = sideAt >= 0 ? cell.grossA[sideAt] : cell.grossB[m.sideB.indexOf(entity)];
    out.push({
      session: s,
      match: m,
      entity,
      hole: c.hole,
      counting,
      entries: c.entries.map((e) => ({ name: tour.playerById.get(e.player)?.name ?? "Organizer", strokes: e.strokes, at: e.at })),
    });
  }
  return out;
}
