import Link from "next/link";
import { Button, Card, Field, Flash, inputCls, Pill } from "@/components/ui";
import { currentTour } from "@/lib/current";
import { FORMAT_LABEL } from "@/lib/scoring";
import type { SessionView } from "@/lib/tour";
import { dayDate } from "@/lib/view";
import { addDay, addSession, updateEvent } from "./actions";

export const dynamic = "force-dynamic";

function statusPill(s: SessionView) {
  const st = s.session.status;
  if (st === "complete") return <Pill tone="green">{s.day.revealed_at ? "Revealed" : "Complete"}</Pill>;
  if (st === "live") return <Pill tone="red">Live</Pill>;
  if (st === "pairing") return <Pill tone="gold">Pairings {new Set(s.pairings.map((p) => p.team_id)).size}/2</Pill>;
  return <Pill tone="grey">Draft</Pill>;
}

export default async function AdminEventPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const sp = await searchParams;
  const tour = await currentTour();
  return (
    <>
      {sp.saved && <Flash>Event saved.</Flash>}
      <Card>
        <form action={updateEvent} className="flex flex-col gap-3">
          <Field label="Event name">
            <input name="name" defaultValue={tour.event.name} required className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="New event password">
              <input name="password" type="password" placeholder="unchanged" autoComplete="new-password" className={inputCls} />
            </Field>
            <Field label="Hidden last holes">
              <input name="hidden_holes" type="number" min={0} max={9} defaultValue={tour.event.hidden_holes} className={inputCls} />
            </Field>
          </div>
          <Button variant="ghost" type="submit">Save event</Button>
        </form>
      </Card>

      <h2 className="mt-1 text-base font-bold">Days &amp; sessions</h2>
      {tour.days.map((d) => (
        <Card key={d.day.id}>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold">Day {d.day.number} · {dayDate(d)}</span>
            <span className="text-xs text-muted">{d.course.course.name}</span>
          </div>
          {d.sessions.map((s) => (
            <Link key={s.session.id} href={`/admin/sessions/${s.session.id}`} className="grid grid-cols-[38px_1fr_auto] items-center gap-2.5 border-t border-[#f0ede6] pt-2.5">
              <span className="rounded-lg bg-[#edeae3] py-1.5 text-center text-[11px] font-bold">{s.session.slot}</span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{FORMAT_LABEL[s.session.format]}</span>
                <span className="text-xs text-muted">
                  {s.session.holes === 18 ? "18 holes" : `9 holes · ${s.session.nine}`} · {s.session.tee_time}
                </span>
              </span>
              {statusPill(s)}
            </Link>
          ))}
          {d.sessions.length < 2 && (
            <details className="border-t border-[#f0ede6] pt-2.5">
              <summary className="cursor-pointer py-1 text-sm font-bold text-[#1d5bbf]">+ Add session</summary>
              <form action={addSession.bind(null, d.day.id)} className="mt-3 grid grid-cols-2 gap-2.5">
                <Field label="Slot">
                  <select name="slot" className={inputCls} defaultValue={d.sessions[0]?.session.slot === "AM" ? "PM" : "AM"}>
                    <option value="AM">Morning</option>
                    <option value="PM">Afternoon</option>
                  </select>
                </Field>
                <Field label="Format">
                  <select name="format" className={inputCls}>
                    {Object.entries(FORMAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Holes">
                  <select name="holes" className={inputCls}>
                    <option value="18">18</option>
                    <option value="9">9</option>
                  </select>
                </Field>
                <Field label="Nine (9-hole only)">
                  <select name="nine" className={inputCls}>
                    <option value="front">Front</option>
                    <option value="back">Back</option>
                  </select>
                </Field>
                <Field label="Tee-off">
                  <input name="tee_time" type="time" defaultValue="07:30" className={inputCls} />
                </Field>
                <Button type="submit" className="self-end">Add</Button>
              </form>
            </details>
          )}
        </Card>
      ))}

      <Card>
        <details>
          <summary className="cursor-pointer text-sm font-bold text-[#1d5bbf]">+ Add day</summary>
          <form action={addDay} className="mt-3 grid grid-cols-2 gap-2.5">
            <Field label="Date">
              <input name="date" type="date" required className={inputCls} />
            </Field>
            <Field label="Course">
              <select name="course_id" className={inputCls}>
                {tour.courses.map((c) => <option key={c.course.id} value={c.course.id}>{c.course.name}</option>)}
              </select>
            </Field>
            <Button type="submit" className="col-span-2">Add day</Button>
          </form>
        </details>
      </Card>
    </>
  );
}
