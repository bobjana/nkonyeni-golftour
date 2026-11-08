import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { LockIcon, PenIcon } from "@/components/icons";
import { MatchCard } from "@/components/MatchCard";
import { Notices } from "@/components/Notices";
import { Scoreboard } from "@/components/Scoreboard";
import { currentTour } from "@/lib/current";
import { fmtPts } from "@/lib/scoring";
import { groupMatches } from "@/lib/tour";
import { sessionTitle, toWin } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const tour = await currentTour();
  // Morning and afternoon can overlap, so every live session is listed; the header shows the latest.
  const lives = tour.sessions.filter((s) => s.session.status === "live");
  const session = lives.at(-1);

  if (!session) {
    return (
      <div className="flex flex-1 flex-col">
        <Notices tour={tour} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-lg font-semibold">No session in play right now</p>
          <Link href="/standings" className="rounded-xl bg-navy px-5 py-3 font-semibold text-white">See standings</Link>
        </div>
      </div>
    );
  }

  const scoring = lives
    .map((s) => ({ s, mine: groupMatches(s, tour.viewer!.id) }))
    .find(({ mine }) => mine.some((m) => m.completed < m.holes.length));
  const nextHole = scoring?.s.played.find((h) => scoring.mine.some((m) => !m.holes.find((c) => c.number === h.number)?.result))?.number;

  return (
    <div className="relative flex flex-1 flex-col">
      <header className="flex flex-col gap-3.5 bg-navy px-5 pt-5 pb-6 text-white">
        <div className="flex items-center justify-between">
          <span className="font-display text-[15px] font-bold tracking-[2px] text-gold uppercase">{tour.event.name}</span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-[#3ddc84]" />
            LIVE
          </span>
        </div>
        <span className="text-[13px] text-mist">{sessionTitle(session)} · {tour.days.find((d) => d.day.id === session.day.id)?.course.course.name}</span>
        <Scoreboard
          teams={tour.teams}
          points={tour.points}
          available={tour.available}
          caption={`TOUR · of ${tour.available}`}
          footer={
            <div className="flex justify-between text-xs text-mist">
              <span>This session {fmtPts(session.points.a)}</span>
              <span>{fmtPts(toWin(tour))} to win</span>
              <span>{fmtPts(session.points.b)} this session</span>
            </div>
          }
        />
      </header>
      <Notices tour={tour} />

      <div className="flex flex-col gap-3 p-4 pb-28">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold">Live matches</h2>
          <AutoRefresh />
        </div>
        {lives.map((s) => (
          <section key={s.session.id} className="flex flex-col gap-3">
            {lives.length > 1 && <h3 className="text-[13px] font-semibold text-muted">{sessionTitle(s)}</h3>}
            {s.matches.map((m) => (
              <MatchCard key={m.match.id} m={m} teams={tour.teams} label={`Match ${m.match.match_no}`} />
            ))}
            {!s.day.revealed_at && s.hidden.length > 0 && (
              <div className="flex items-center gap-2.5 rounded-xl border border-[#e8d48a] bg-gold-soft px-3 py-2.5 text-[13px] text-[#5c4a0e]">
                <LockIcon size={18} />
                <span>
                  Holes {s.hidden[0]}–{s.hidden[s.hidden.length - 1]} are hidden until the Grand Reveal.
                </span>
              </div>
            )}
          </section>
        ))}
        <div className="flex flex-wrap items-center gap-3.5 text-[11px] text-muted">
          {tour.teams.map((t) => (
            <span key={t.id} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: t.color }} />
              {t.name} hole
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[#b9c0cb]" />
            Halved
          </span>
        </div>
      </div>

      {scoring && nextHole && (
        <Link
          href={`/score/${scoring.s.session.id}`}
          className="fixed right-4 bottom-24 z-30 flex items-center gap-2 rounded-full bg-gold px-5 py-3.5 text-[15px] font-bold text-navy shadow-[0_6px_16px_rgba(11,31,58,0.25)] min-[480px]:right-[calc(50%-224px)]"
        >
          <PenIcon size={18} />
          Score hole {nextHole}
        </Link>
      )}
    </div>
  );
}
