import Link from "next/link";
import { dayConflicts } from "@/lib/score-checks";
import type { Tour } from "@/lib/tour";
import { sessionTitle } from "@/lib/view";
import { RevealOverlay } from "./RevealOverlay";

/** Captain and organizer to-dos and the post-reveal celebration, shown on the main player screens. */
export async function Notices({ tour }: { tour: Tour }) {
  const v = tour.viewer;
  const captainOf = v ? tour.teams.find((t) => t.captain_id === v.id) : undefined;
  const pending = captainOf
    ? tour.sessions.filter((s) => s.session.status === "pairing" && !s.pairings.some((p) => p.team_id === captainOf.id))
    : [];
  const revealed = [...tour.days].reverse().find((d) => d.day.revealed_at);
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
      {revealed && (
        <RevealOverlay
          dayKey={`${revealed.day.id}:${revealed.day.revealed_at}`}
          revealedAt={revealed.day.revealed_at!}
          dayNumber={revealed.day.number}
          teams={tour.teams.map((t) => ({ name: t.name, color: t.color }))}
          day={revealed.points}
          tour={tour.points}
        />
      )}
    </>
  );
}
