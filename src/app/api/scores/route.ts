import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { newId } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { loadTour } from "@/lib/tour";

type Entry = { matchId: string; entityId: string; hole: number; strokes: number; at: string };

/**
 * Accepts queued scorecard entries (possibly sent hours late from an offline
 * phone). Latest write per hole wins, judged by the time it was entered.
 */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Signed out. Sign in again to sync your scores." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { entries?: Entry[] } | null;
  const entries = body?.entries ?? [];
  if (!Array.isArray(entries) || entries.length > 500) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const tour = await loadTour(viewer.event_id, viewer);
  const matchIndex = new Map(tour.sessions.flatMap((s) => s.matches.map((m) => [m.match.id, { s, m }] as const)));
  const db = await getDb();
  const touched = new Set<string>();

  for (const e of entries) {
    const found = matchIndex.get(e.matchId);
    if (!found) continue;
    const { s, m } = found;
    const groupScorer = s.matches.some((x) => x.match.group_no === m.match.group_no && x.match.scorer_id === viewer.id);
    if (!viewer.is_organizer && (!groupScorer || s.session.status !== "live")) {
      return NextResponse.json({ error: "You're not the scorer for this match." }, { status: 403 });
    }
    const valid =
      [...m.sideA, ...m.sideB].some((x) => x.id === e.entityId) &&
      s.played.some((h) => h.number === e.hole) &&
      Number.isInteger(e.strokes) && e.strokes >= 0 && e.strokes <= 20;
    if (!valid) continue;
    const at = Number.isNaN(Date.parse(e.at)) ? new Date().toISOString() : new Date(e.at).toISOString();

    await db
      .insertInto("scores")
      .values({ match_id: e.matchId, entity_id: e.entityId, hole: e.hole, strokes: e.strokes, updated_at: at, updated_by: viewer.id })
      .onConflict((oc) =>
        oc
          .columns(["match_id", "entity_id", "hole"])
          .doUpdateSet({ strokes: e.strokes, updated_at: at, updated_by: viewer.id })
          .where("scores.updated_at", "<=", at),
      )
      .execute();
    await db.insertInto("score_log").values({ id: newId(), match_id: e.matchId, entity_id: e.entityId, hole: e.hole, strokes: e.strokes, at, actor: viewer.id }).execute();
    touched.add(s.session.id);
  }

  // A session finishes itself once every hole of every match is in.
  if (touched.size) {
    const fresh = await loadTour(viewer.event_id, null);
    for (const s of fresh.sessions) {
      if (touched.has(s.session.id) && s.session.status === "live" && s.matches.length && s.matches.every((m) => m.completed === m.holes.length)) {
        await db.updateTable("sessions").set({ status: "complete" }).where("id", "=", s.session.id).execute();
      }
    }
  }
  return NextResponse.json({ ok: true, saved: entries.length });
}
