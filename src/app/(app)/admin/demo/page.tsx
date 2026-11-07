import { redirect } from "next/navigation";
import { Button, Card, Field, Flash, inputCls, Pill } from "@/components/ui";
import { currentTour } from "@/lib/current";
import { demoEnabled, demoStatus, SPEEDS } from "@/lib/demo";
import { pause, resume, skip, speed, start, stop } from "./actions";

export const dynamic = "force-dynamic";

const clock = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, "0")}s` : `${sec}s`);
const speedLabel = (x: number) => (x === 0.5 ? "½×" : `${x}×`);

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!demoEnabled()) redirect("/admin");
  const sp = await searchParams;
  const tour = await currentTour();
  const demo = await demoStatus(tour.event.id);
  const active = demo && !demo.finished;
  const captains = new Set(tour.teams.map((t) => t.captain_id));
  const scorers = new Set(tour.sessions.flatMap((s) => (s.session.status === "live" ? s.matches.map((m) => m.match.scorer_id) : [])));

  return (
    <>
      {sp.error === "confirm" && <Flash tone="red">Tick the box to confirm the reset first.</Flash>}

      {active ? (
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-base font-bold">Demo {demo.running ? "running" : "paused"}</span>
            <Pill tone={demo.running ? "red" : "grey"}>{demo.running ? `LIVE · ${speedLabel(demo.speed)}` : "PAUSED"}</Pill>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#edeae3]">
            <div className="h-full rounded-full bg-gold" style={{ width: `${Math.round((demo.cursor / demo.total) * 100)}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>Step {demo.cursor} of {demo.total}</span>
            <span>About {clock(demo.remaining)} to go</span>
          </div>
          {demo.next && (
            <p className="rounded-xl bg-sand px-3 py-2.5 text-sm">
              <span className="text-muted">Up next: </span>
              <b>{demo.next.moment}</b>
              {demo.running && <span className="text-muted"> · in {clock(demo.next.inSeconds)}</span>}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <form action={demo.running ? pause : resume}>
              <Button variant="navy" className="w-full">{demo.running ? "Pause" : "Resume"}</Button>
            </form>
            <form action={skip}>
              <Button variant="gold" className="w-full" disabled={!demo.next}>Skip to next</Button>
            </form>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">Speed</span>
            <div className="grid grid-cols-4 gap-1.5">
              {SPEEDS.map((x) => (
                <form key={x} action={speed.bind(null, x)}>
                  <button className={`h-10 w-full rounded-[10px] text-sm font-bold ${x === demo.speed ? "bg-navy text-white" : "border border-[#d8dce3] bg-white text-navy"}`}>
                    {speedLabel(x)}
                  </button>
                </form>
              ))}
            </div>
          </div>
          {demo.recent.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-[#f0ede6] pt-2.5">
              <span className="text-xs font-semibold text-muted">Just happened</span>
              {demo.recent.map((r, i) => (
                <span key={i} className={`text-sm ${i === 0 ? "font-semibold" : "text-muted"}`}>{r}</span>
              ))}
            </div>
          )}
          <form action={stop}>
            <Button variant="danger" className="w-full">Stop demo</Button>
          </form>
          <p className="text-xs text-muted">Stopping freezes the tour where it is. Start again to replay from the top.</p>
        </Card>
      ) : (
        <Card>
          <span className="text-base font-bold">{demo?.finished ? "Demo finished" : "Run a demo tour"}</span>
          <p className="text-sm text-[#3a4352]">
            Plays the whole tour on a fast clock: captains submit pairings, the draw goes live, each group&apos;s scorer enters hole by hole, the last
            holes go dark and every evening ends in the Grand Reveal. Everyone signed in sees it happen on their own phone.
          </p>
          <form action={start} className="flex flex-col gap-3">
            <Field label="Speed">
              <select name="speed" defaultValue="1" className={inputCls}>
                {SPEEDS.map((x) => (
                  <option key={x} value={x}>
                    {speedLabel(x)} {x === 1 ? "(about 30 minutes for all three days)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-start gap-2.5 rounded-xl bg-[#fcebee] p-3 text-sm text-[#8e0b20]">
              <input type="checkbox" name="confirm" className="mt-0.5 size-4" />
              <span>Starting wipes every pairing, score and reveal in this event. Players, teams and courses stay.</span>
            </label>
            <Button variant="gold" type="submit">{demo?.finished ? "Start again" : "Start demo"}</Button>
          </form>
        </Card>
      )}

      <Card>
        <span className="text-sm font-bold">Watch from another phone</span>
        <p className="text-xs text-muted">Sign in with the event password as any of these. Captains get the pairing screens, scorers land on their card.</p>
        {tour.teams.map((t) => (
          <div key={t.id} className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase" style={{ color: t.color }}>{t.name}</span>
            {tour.players
              .filter((p) => p.team_id === t.id)
              .map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{p.name}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {captains.has(p.id) && <Pill tone="gold">Captain</Pill>}
                    {scorers.has(p.id) && <Pill tone="green">Scoring now</Pill>}
                    <span className="text-xs text-muted">{p.email}</span>
                  </span>
                </div>
              ))}
          </div>
        ))}
      </Card>
    </>
  );
}
