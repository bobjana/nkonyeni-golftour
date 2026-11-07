import { currentTour } from "@/lib/current";
import { courseHandicap } from "@/lib/scoring";
import { teamOf } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const tour = await currentTour();
  const me = tour.viewer!;
  const team = teamOf(tour, me.team_id);
  const course = tour.courses[0];
  const tee = course?.tees.find((t) => t.id === me.tee_id) ?? course?.defaultTee;
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">{me.name}</h1>
      <section className="flex flex-col gap-2 rounded-2xl bg-white p-4 text-sm">
        <Row k="Team" v={<span className="font-semibold" style={{ color: team?.color }}>{team?.name}{team?.captain_id === me.id ? " · Captain" : ""}</span>} />
        <Row k="Email" v={me.email} />
        <Row k="Handicap index" v={me.handicap_index.toFixed(1)} />
        {course && tee && <Row k={`Course handicap (${tee.name})`} v={String(courseHandicap(me.handicap_index, tee, course.par))} />}
      </section>
      <p className="rounded-xl bg-gold-soft px-4 py-3 text-[13px] text-[#5c4a0e]">
        Tip: add this app to your home screen (Share → Add to Home Screen) for one-tap access on the course.
      </p>
      <form action="/logout" method="post">
        <button type="submit" className="h-12 w-full rounded-xl border border-line bg-white font-semibold">Sign out</button>
      </form>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#f0ede6] pb-2 last:border-0 last:pb-0">
      <span className="text-muted">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
