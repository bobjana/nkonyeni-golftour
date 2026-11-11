import Link from "next/link";
import { dayConflicts } from "@/lib/score-checks";
import type { DayView, Tour } from "@/lib/tour";
import { dayComplete, latestCompleteSession, sessionTitle } from "@/lib/view";
import { RevealOverlay } from "./RevealOverlay";

/** Captain and organizer to-dos and the post-reveal celebration, shown on the main player screens. */
export async function Notices({ tour }: { tour: Tour }) {
  const v = tour.viewer;
  const captainOf = v ? tour.teams.find((t) => t.captain_id === v.id) : undefined;
  const pending = captainOf
    ? tour.sessions.filter((s) => s.session.status === "pairing" && !s.pairings.some((p) => p.team_id === captainOf.id))
    : [];
  const revealed = [...tour.days].reverse().find((d) => d.day.revealed_at);
  // A mid-day reveal celebrates the day's latest finished session; a complete day the day itself.
  // If nothing has finished yet there is no result to celebrate, so the drumroll is skipped.
  let reveal: { day: DayView; full: boolean; pts: { a: number; b: number } } | undefined;
  if (revealed) {
    const full = dayComplete(revealed);
    const session = full ? undefined : latestCompleteSession(revealed);
    if (full || session) reveal = { day: revealed, full, pts: full ? revealed.points : session!.points };
  }
  // End of a day's play: tell the organizer about cards that disagree.
  const checks = [];
  if (v?.is_organizer) {
    for (const d of tour.days) {
      const played = d.sessions.filter((s) => s.matches.length);
      if (!played.length || played.some((s) => s.session.status !== "complete")) continue;
      const n = (await dayConflicts(tour, d.day.id)).length;
      if (n) checks.push({ day: d, n });
    }
  }
  return (
    <>
      {pending.map((s) => (
        <Link
          key={s.session.id}
          href={`/captain/${s.session.id}`}
          className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white"
          style={{ background: captainOf!.color }}
        >
          <span>Captain: submit pairings for {sessionTitle(s)}</span>
          <span aria-hidden>→</span>
        </Link>
      ))}
      {checks.map(({ day, n }) => (
        <Link
          key={day.day.id}
          href={`/admin/reveal?day=${day.day.id}`}
          className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#f2b8c2] bg-[#fcebee] px-4 py-3 text-sm font-semibold text-[#8e0b20]"
        >
          <span>Day {day.day.number}: {n} score{n > 1 ? "s" : ""} to check — group cards disagree</span>
          <span aria-hidden>→</span>
        </Link>
      ))}
      {reveal && (
        <RevealOverlay
          dayKey={`${reveal.day.day.id}:${reveal.day.day.revealed_at}`}
          revealedAt={reveal.day.day.revealed_at!}
          dayNumber={reveal.day.day.number}
          teams={tour.teams.map((t) => ({ name: t.name, color: t.color }))}
          day={reveal.pts}
          scope={reveal.full ? "day" : "session"}
          tour={tour.points}
        />
      )}
    </>
  );
}
