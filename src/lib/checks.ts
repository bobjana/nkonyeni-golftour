// Score checks: anyone in a group may keep the card, so two phones can
// disagree about a hole. A disagreement is when different people's latest
// entries for the same player and hole differ; one person correcting their
// own entry is not. The organizer's ruling settles it until someone enters
// a different value afterwards.
import type { ScoreCheckRow, ScoreLogRow } from "./db/types";

/** Demo entries are logged as "demo:<playerId>" so they count as that player. */
export const actorPlayer = (actor: string) => actor.replace(/^demo:/, "");
/** Rulings are logged for the audit trail but are not someone's card. */
const isRuling = (actor: string) => actor.startsWith("ruling:");

export interface Conflict {
  matchId: string;
  entityId: string;
  hole: number;
  /** each person's latest entry, oldest first */
  entries: { player: string; strokes: number; at: string }[];
}

export function findConflicts(log: Pick<ScoreLogRow, "match_id" | "entity_id" | "hole" | "strokes" | "at" | "actor">[], checks: Pick<ScoreCheckRow, "match_id" | "entity_id" | "hole" | "strokes" | "resolved_at">[]): Conflict[] {
  const latest = new Map<string, Map<string, { strokes: number; at: string }>>();
  for (const r of log) {
    if (r.strokes === null || isRuling(r.actor)) continue;
    const key = `${r.match_id}|${r.entity_id}|${r.hole}`;
    const byPlayer = latest.get(key) ?? new Map();
    const player = actorPlayer(r.actor);
    const prev = byPlayer.get(player);
    if (!prev || prev.at <= r.at) byPlayer.set(player, { strokes: r.strokes, at: r.at });
    latest.set(key, byPlayer);
  }
  const ruled = new Map(checks.map((c) => [`${c.match_id}|${c.entity_id}|${c.hole}`, c]));
  const out: Conflict[] = [];
  for (const [key, byPlayer] of latest) {
    const entries = [...byPlayer].map(([player, e]) => ({ player, ...e })).sort((a, b) => a.at.localeCompare(b.at));
    if (new Set(entries.map((e) => e.strokes)).size < 2) continue;
    const ruling = ruled.get(key);
    // settled unless someone entered a different value after the ruling
    if (ruling && entries.every((e) => e.at <= ruling.resolved_at || e.strokes === ruling.strokes)) continue;
    const [matchId, entityId, hole] = key.split("|");
    out.push({ matchId, entityId, hole: Number(hole), entries });
  }
  return out.sort((a, b) => a.matchId.localeCompare(b.matchId) || a.hole - b.hole);
}
