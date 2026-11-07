import { MatchCard } from "@/components/MatchCard";
import { currentTour } from "@/lib/current";
import { fmtPts } from "@/lib/scoring";
import { dayDate, sessionDetail, sessionTitle } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const tour = await currentTour();
  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-2xl font-bold">Matches</h1>
      {tour.days.map((d) => (
        <section key={d.day.id} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted">
            Day {d.day.number} · {dayDate(d)} · {d.course.course.name}
          </h2>
          {d.sessions.map((s) => (
            <div key={s.session.id} className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{sessionTitle(s)}</span>
                {s.matches.length > 0 && (
                  <span className="text-sm font-bold">
                    <span style={{ color: tour.teams[0].color }}>{fmtPts(s.points.a)}</span> –{" "}
                    <span style={{ color: tour.teams[1].color }}>{fmtPts(s.points.b)}</span>
                  </span>
                )}
              </div>
              {s.matches.length ? (
                s.matches.map((m) => <MatchCard key={m.match.id} m={m} teams={tour.teams} label={`Match ${m.match.match_no}`} />)
              ) : (
                <p className="rounded-xl bg-white px-4 py-3 text-sm text-muted">{sessionDetail(s)} · draw not published yet</p>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
