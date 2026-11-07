import { notFound, redirect } from "next/navigation";
import { currentTour } from "@/lib/current";
import { scorerMatches } from "@/lib/tour";
import { sessionTitle } from "@/lib/view";
import { ScoreCard, type CardMatch } from "./ScoreCard";

export const dynamic = "force-dynamic";

export default async function ScorePage({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ group?: string }> }) {
  const { sessionId } = await params;
  const { group } = await searchParams;
  const tour = await currentTour();
  const me = tour.viewer!;
  const s = tour.sessions.find((x) => x.session.id === sessionId);
  if (!s) notFound();

  let mine = scorerMatches(s, me.id);
  if (me.is_organizer && group) mine = s.matches.filter((m) => m.match.group_no === Number(group));
  if (!mine.length) redirect("/live");
  if (s.session.status !== "live" && !me.is_organizer) redirect("/live");

  const day = tour.days.find((d) => d.day.id === s.day.id)!;
  const tee = day.course.defaultTee;
  const lengths: number[] = tee ? JSON.parse(tee.lengths) : [];

  const matches: CardMatch[] = mine.map((m) => {
    const toSide = (side: typeof m.sideA, received: (h: (typeof m.holes)[number]) => number[]) =>
      side.map((e, i) => ({
        id: e.id,
        label: e.label,
        strokes: e.strokes,
        // Foursomes: player 1 tees off on the odd holes of the session, player 2 on the even ones.
        teeOrder: s.session.format === "foursomes" ? e.players.map((p) => p.name.split(" ")[0]) : [],
        received: Object.fromEntries(m.holes.map((h) => [h.number, received(h)[i]])),
      }));
    const scores: Record<string, Record<number, number>> = {};
    for (const h of m.holes) {
      [...m.sideA, ...m.sideB].forEach((e, i) => {
        const g = [...h.grossA, ...h.grossB][i];
        if (g !== undefined) (scores[e.id] ??= {})[h.number] = g;
      });
    }
    return {
      id: m.match.id,
      matchNo: m.match.match_no,
      sideA: toSide(m.sideA, (h) => h.receivedA),
      sideB: toSide(m.sideB, (h) => h.receivedB),
      scores,
    };
  });

  return (
    <ScoreCard
      sessionId={s.session.id}
      title={sessionTitle(s)}
      format={s.session.format}
      teeName={tee?.name ?? ""}
      holes={s.played.map((h) => ({ ...h, length: lengths[h.number - 1] }))}
      hidden={day.day.revealed_at ? [] : s.hidden}
      teams={tour.teams.map((t) => ({ name: t.name, color: t.color }))}
      matches={matches}
    />
  );
}
