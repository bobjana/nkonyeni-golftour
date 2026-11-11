import Link from "next/link";
import { LockIcon, TrophyIcon } from "@/components/icons";
import { Notices } from "@/components/Notices";
import { Scoreboard } from "@/components/Scoreboard";
import { currentTour } from "@/lib/current";
import { fmtPts } from "@/lib/scoring";
import { playersOf } from "@/lib/tour";
import { dayComplete, latestCompleteSession, sessionDetail, sessionTitle, toWin } from "@/lib/view";

export const dynamic = "force-dynamic";

const greeting = () => {
  const h = Number(new Date().toLocaleString("en-ZA", { hour: "numeric", hour12: false, timeZone: "Africa/Mbabane" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export default async function StandingsPage() {
  const tour = await currentTour();
  const me = tour.viewer!;
  const played = tour.days.filter((d) => d.sessions.some((s) => s.matches.some((m) => m.thru > 0)));
  const lastDay = played.at(-1);
  const next = tour.sessions.find((s) => s.session.status !== "complete");
  const myMatch = next?.matches.find((m) => playersOf(m).some((p) => p.id === me.id));
  const scoring = next?.matches.some((m) => m.match.scorer_id === me.id);
  const inPlay = lastDay?.sessions.some((s) => s.session.status !== "complete");
  const afterLabel = !lastDay ? "Before play" : inPlay ? `Day ${lastDay.day.number} in progress` : `After Day ${lastDay.day.number}`;
  // The recap line names the day when every session has finished; otherwise the latest finished session.
  // With no finished session there is no result to name, so the line is skipped.
  const dayDone = lastDay ? dayComplete(lastDay) : false;
  const lastSession = lastDay && !dayDone ? latestCompleteSession(lastDay) : undefined;
  const recap = lastDay && (dayDone || lastSession)
    ? { scope: dayDone ? "day" : "session", pts: dayDone ? lastDay.points : lastSession!.points }
    : null;
  const dayWinner = recap && recap.pts.a !== recap.pts.b ? (recap.pts.a > recap.pts.b ? tour.teams[0] : tour.teams[1]) : null;

  return (
    <div className="flex flex-col">
      <Notices tour={tour} />
      <div className="flex flex-col gap-3.5 p-4">
        <div>
          <p className="text-[13px] text-muted">{greeting()}</p>
          <h1 className="text-2xl font-bold">{me.name.split(" ")[0]}</h1>
        </div>

        <section className="flex flex-col gap-3 rounded-[20px] bg-navy p-4.5 text-white">
          <div className="flex items-center justify-between">
            <span className="font-display text-sm font-bold tracking-[2px] text-gold">OVERALL STANDINGS</span>
            <span className="text-xs text-mist">{afterLabel}</span>
          </div>
          <Scoreboard
            teams={tour.teams}
            points={tour.points}
            available={tour.available}
            caption={`of ${tour.available}`}
            footer={<p className="text-center text-xs text-mist">First to {fmtPts(toWin(tour))} points wins the tour</p>}
          />
        </section>

        {lastDay && (
          <section className="flex flex-col gap-3 rounded-2xl bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Day {lastDay.day.number} recap</h2>
              {lastDay.day.revealed_at ? (
                <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-ink">Revealed</span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-ink">
                  <LockIcon size={12} /> Reveal pending
                </span>
              )}
            </div>
            {lastDay.day.revealed_at && (
              <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ background: "#f4f1ea" }}>
                <TrophyIcon size={20} className="text-gold-ink" />
                {dayWinner && recap ? (
                  <span style={{ color: dayWinner.color }}>
                    {dayWinner.name} won the {recap.scope} {fmtPts(Math.max(recap.pts.a, recap.pts.b))} – {fmtPts(Math.min(recap.pts.a, recap.pts.b))}
                  </span>
                ) : recap ? (
                  <span>{recap.scope === "day" ? "Day" : "Session"} halved {fmtPts(recap.pts.a)} – {fmtPts(recap.pts.b)}</span>
                ) : null}
              </div>
            )}
            {lastDay.sessions.filter((s) => s.matches.length).map((s) => (
              <div key={s.session.id} className="flex flex-col gap-1">
                <span className="text-[13px] text-muted">{sessionTitle(s)}</span>
                {s.matches.map((m) => (
                  <Link key={m.match.id} href={`/match/${m.match.id}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-[#eeebe4] py-1.5 text-[13px]">
                    <span className="font-semibold" style={{ color: tour.teams[0].color }}>{m.sideA.map((e) => e.short).join(" & ")}</span>
                    <span className="font-display text-xl font-bold">{fmtPts(m.points.a)} – {fmtPts(m.points.b)}</span>
                    <span className="text-right font-semibold" style={{ color: tour.teams[1].color }}>{m.sideB.map((e) => e.short).join(" & ")}</span>
                  </Link>
                ))}
              </div>
            ))}
          </section>
        )}

        {next && (
          <section className="flex flex-col gap-2 rounded-2xl border-2 border-gold bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">{next.session.status === "live" ? "In play" : "Next up"}</h2>
              {scoring && <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-navy">You&apos;re scoring</span>}
            </div>
            <p className="text-sm text-[#3a4352]">{sessionTitle(next)} · {sessionDetail(next)}</p>
            {myMatch ? (
              <p className="text-sm">
                <b style={{ color: tour.teams[0].color }}>{myMatch.sideA.map((e) => e.label).join(" & ")}</b> vs{" "}
                <b style={{ color: tour.teams[1].color }}>{myMatch.sideB.map((e) => e.label).join(" & ")}</b>
              </p>
            ) : (
              <p className="text-sm text-muted">The draw hasn&apos;t been published yet.</p>
            )}
            {next.session.status === "live" && (
              <Link href="/" className="mt-1 rounded-xl bg-navy py-3 text-center font-semibold text-white">
                {scoring ? "Open my scorecard" : "Follow live"}
              </Link>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
