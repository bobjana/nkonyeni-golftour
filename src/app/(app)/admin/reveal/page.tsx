import Link from "next/link";
import { LockIcon } from "@/components/icons";
import { Button, Flash } from "@/components/ui";
import { currentTour } from "@/lib/current";
import { fmtPts } from "@/lib/scoring";
import { dayConflicts } from "@/lib/score-checks";
import { loadTour } from "@/lib/tour";
import { dayDate } from "@/lib/view";
import { setReveal } from "../actions";
import { ScoreChecks, type CheckItem } from "./ScoreChecks";

export const dynamic = "force-dynamic";

export default async function RevealPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const sp = await searchParams;
  const tour = await currentTour();
  // What everyone else sees right now (no organizer privileges).
  const publicView = await loadTour(tour.event.id, null);
  const days = tour.days.filter((d) => d.sessions.some((s) => s.matches.length));
  const day = days.find((d) => d.day.id === sp.day) ?? days.find((d) => !d.day.revealed_at) ?? days.at(-1);
  if (!day) return <Flash tone="red">No sessions have been played yet.</Flash>;
  const pubDay = publicView.days.find((d) => d.day.id === day.day.id)!;
  const hiddenRows = day.sessions
    .filter((s) => s.hidden.length > 0)
    .flatMap((s) => s.matches.map((m) => ({ s, m, cells: m.holes.filter((h) => h.hiddenHole) })));
  const hiddenPts = hiddenRows.reduce((a, r) => a + r.cells.length, 0);
  const [ta, tb] = tour.teams;
  const revealed = !!day.day.revealed_at;
  const conflicts = await dayConflicts(tour, day.day.id);
  const checks: CheckItem[] = conflicts.map((c) => {
    const values = [...new Set(c.entries.map((e) => e.strokes))].map((strokes) => ({
      strokes,
      names: c.entries.filter((e) => e.strokes === strokes).map((e) => e.name),
    }));
    return {
      key: `${c.match.match.id}|${c.entity.id}|${c.hole}`,
      matchId: c.match.match.id,
      entityId: c.entity.id,
      hole: c.hole,
      title: `${c.session.session.slot} · Match ${c.match.match.match_no} · Hole ${c.hole}${c.match.holes.find((h) => h.number === c.hole)?.hiddenHole ? " (hidden)" : ""}`,
      entityLabel: c.entity.label,
      counting: c.counting,
      values,
      card: c.card,
    };
  });

  return (
    <div className="-m-3.5 flex flex-col gap-4 bg-navy-deep p-4.5 text-white">
      {days.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {days.map((d) => (
            <Link key={d.day.id} href={`/admin/reveal?day=${d.day.id}`} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${d === day ? "bg-gold text-navy" : "bg-white/10"}`}>
              Day {d.day.number}
            </Link>
          ))}
        </div>
      )}
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="font-display text-base font-bold tracking-[4px] text-gold">DAY {day.day.number} · {dayDate(day).toUpperCase()}</span>
        <h1 className="font-display text-5xl leading-none font-bold">GRAND REVEAL</h1>
        <span className="text-sm text-mist">
          {revealed ? "Revealed to everyone" : hiddenPts ? `${hiddenPts} hidden hole results · ${hiddenPts} points still to come` : "No hidden results yet — cards are fully visible"}
        </span>
      </div>

      <section className="flex flex-col gap-2.5 rounded-[20px] border border-gold/40 bg-white/5 p-4">
        <span className="text-center text-xs text-mist">{revealed ? "Day result" : "Day score everyone can see now"}</span>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase" style={{ color: "#ffb3bf" }}>{ta.name}</span>
            <span className="font-display text-6xl leading-none font-bold">{fmtPts(pubDay.points.a)}</span>
          </div>
          {!revealed && <LockIcon size={28} className="text-gold" />}
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold uppercase" style={{ color: "#b8cfff" }}>{tb.name}</span>
            <span className="font-display text-6xl leading-none font-bold">{fmtPts(pubDay.points.b)}</span>
          </div>
        </div>
        {!revealed && (
          <p className="text-center text-xs text-mist">
            After the reveal: <b className="text-white">{fmtPts(day.points.a)} – {fmtPts(day.points.b)}</b> (only you can see this)
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        {hiddenRows.map(({ s, m, cells }) => (
          <div key={m.match.id} className="grid grid-cols-[1fr_auto] items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5">
            <span className="flex flex-col">
              <span className="text-[13px] font-semibold">{s.session.slot} · Match {m.match.match_no}</span>
              <span className="text-[11px] text-mist">{m.sideA.map((e) => e.short).join(" & ")} v {m.sideB.map((e) => e.short).join(" & ")}</span>
            </span>
            <span className="flex gap-1">
              {cells.map((h) => (
                <span
                  key={h.number}
                  className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-dashed border-gold text-[11px] font-bold text-gold"
                  style={revealed && h.result ? { background: h.result === "A" ? ta.color : h.result === "B" ? tb.color : "#8a93a1", color: "#fff", borderStyle: "solid" } : undefined}
                >
                  {h.number}
                </span>
              ))}
            </span>
          </div>
        ))}
      </section>

      <ScoreChecks conflicts={checks} />

      {revealed ? (
        <form action={setReveal.bind(null, day.day.id, false)} className="flex flex-col gap-2">
          <Button type="submit" variant="ghost" className="!border-white/25 !bg-transparent !text-white">Hide again</Button>
        </form>
      ) : (
        <form action={setReveal.bind(null, day.day.id, true)} className="flex flex-col gap-2.5">
          {conflicts.length > 0 && <p className="text-center text-xs font-semibold text-[#ffb3bf]">{conflicts.length} score check{conflicts.length > 1 ? "s" : ""} still open above.</p>}
          <Button type="submit" variant="gold" className="h-15 text-lg shadow-[0_0_0_6px_rgba(201,162,39,0.18)]">Reveal to everyone</Button>
          <p className="text-center text-xs leading-snug text-mist">Every phone plays a drumroll, then shows the day&apos;s result and the new standings.</p>
        </form>
      )}
    </div>
  );
}
