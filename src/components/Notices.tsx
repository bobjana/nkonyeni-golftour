import Link from "next/link";
import type { Tour } from "@/lib/tour";
import { sessionTitle } from "@/lib/view";
import { RevealOverlay } from "./RevealOverlay";

/** Captain to-dos and the post-reveal celebration, shown on the main player screens. */
export function Notices({ tour }: { tour: Tour }) {
  const v = tour.viewer;
  const captainOf = v ? tour.teams.find((t) => t.captain_id === v.id) : undefined;
  const pending = captainOf
    ? tour.sessions.filter((s) => s.session.status === "pairing" && !s.pairings.some((p) => p.team_id === captainOf.id))
    : [];
  const revealed = [...tour.days].reverse().find((d) => d.day.revealed_at);
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
