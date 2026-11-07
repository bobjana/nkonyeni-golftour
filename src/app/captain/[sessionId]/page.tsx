import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BackIcon, CheckIcon } from "@/components/icons";
import { currentTour } from "@/lib/current";
import { courseHandicap } from "@/lib/scoring";
import { sessionDetail, sessionTitle } from "@/lib/view";
import { submitPairings } from "../actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  duplicate: "Each player can only be picked once.",
  published: "The organizer has already published the draw for this session.",
};

export default async function CaptainPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ team?: string; error?: string; saved?: string }>;
}) {
  const { sessionId } = await params;
  const sp = await searchParams;
  const tour = await currentTour();
  const me = tour.viewer!;
  const s = tour.sessions.find((x) => x.session.id === sessionId);
  if (!s) notFound();
  const team = tour.teams.find((t) => (me.is_organizer && sp.team ? t.id === sp.team : t.captain_id === me.id));
  if (!team) redirect("/");
  const other = tour.teams.find((t) => t.id !== team.id)!;
  const roster = tour.players.filter((p) => p.team_id === team.id);
  const course = tour.days.find((d) => d.day.id === s.day.id)!.course;
  const ch = (id: string) => {
    const p = tour.playerById.get(id)!;
    const tee = course.tees.find((t) => t.id === p.tee_id) ?? course.defaultTee;
    return tee ? courseHandicap(p.handicap_index, tee, course.par) : Math.round(p.handicap_index);
  };
  const perSlot = s.session.format === "singles" ? 1 : 2;
  const slots = Math.floor(roster.length / perSlot);
  const mine = s.pairings.filter((p) => p.team_id === team.id);
  const theirs = s.pairings.some((p) => p.team_id === other.id);
  const published = s.matches.length > 0;
  const editable = !published && (s.session.status === "pairing" || !!me.is_organizer);
  const action = submitPairings.bind(null, s.session.id, team.id);
  const label = s.session.format === "singles" ? "Match" : "Pair";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-col gap-1.5 px-4 pt-4 pb-4.5 text-white" style={{ background: team.color }}>
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1 text-xs font-bold tracking-wider uppercase">
            <BackIcon size={14} />
            Captain · {team.name}
          </Link>
          {s.session.pairing_deadline && (
            <span className="rounded-full bg-black/20 px-2.5 py-1 text-xs font-semibold">Due {s.session.pairing_deadline}</span>
          )}
        </div>
        <h1 className="text-[22px] font-bold">Pairings for Day {s.day.number} {s.session.slot === "AM" ? "morning" : "afternoon"}</h1>
        <span className="text-[13px] opacity-90">{sessionTitle(s).split(" · ").at(-1)} · {sessionDetail(s)}</span>
      </header>

      <form action={action} className="flex flex-1 flex-col gap-3.5 p-3.5">
        <p className="rounded-xl bg-white px-3 py-2.5 text-[13px] leading-snug text-[#3a4352]">
          Blind draw: {other.name} can&apos;t see your {label.toLowerCase()}s until both captains have submitted.
        </p>
        <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 text-[13px]">
          <span className="font-semibold" style={{ color: other.color }}>{other.name} captain</span>
          {theirs ? (
            <span className="flex items-center gap-1 font-bold"><CheckIcon size={16} />Submitted</span>
          ) : (
            <span className="text-muted">Waiting…</span>
          )}
        </div>
        {sp.error && <p role="alert" className="rounded-lg bg-[#fcebee] px-3 py-2 text-sm text-[#8e0b20]">{ERRORS[sp.error] ?? "Something went wrong."}</p>}
        {sp.saved && <p className="rounded-lg bg-[#e3f4ea] px-3 py-2 text-sm text-[#17643a]">Pairings saved. You can change them until the draw is published.</p>}

        {Array.from({ length: slots }, (_, i) => {
          const existing = mine.find((p) => p.slot === i + 1);
          const picks = [existing?.player1_id, existing?.player2_id];
          return (
            <section key={i} className="flex flex-col gap-2.5 rounded-2xl bg-white p-3.5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[15px] font-bold">{label} {i + 1}</h2>
                {existing && perSlot === 2 && existing.player2_id && (
                  <span className="text-xs text-muted">Combined course hcp {ch(existing.player1_id) + ch(existing.player2_id)}</span>
                )}
              </div>
              <div className={`grid gap-2 ${perSlot === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                {Array.from({ length: perSlot }, (_, j) => (
                  <label key={j} className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-muted">
                      {perSlot === 2 && s.session.format === "foursomes" ? (j === 0 ? "Tees off odd holes" : "Tees off even holes") : `Player ${perSlot === 2 ? j + 1 : ""}`}
                    </span>
                    <select
                      name={`s${i + 1}p${j + 1}`}
                      required
                      disabled={!editable}
                      defaultValue={picks[j] ?? roster[i * perSlot + j]?.id}
                      className="h-12 rounded-xl border-2 bg-[#fcfbf8] px-2 text-sm font-semibold disabled:opacity-70"
                      style={{ borderColor: team.color }}
                    >
                      {roster.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.handicap_index.toFixed(1)})
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </section>
          );
        })}

        <div className="mt-auto flex flex-col gap-2">
          {editable ? (
            <button type="submit" className="h-14 rounded-2xl bg-navy text-base font-bold text-white">
              {mine.length ? "Update pairings" : "Submit pairings"}
            </button>
          ) : (
            <p className="text-center text-sm text-muted">{published ? "The draw is published." : "Pairings open once the organizer starts the draw."}</p>
          )}
        </div>
      </form>
    </div>
  );
}
