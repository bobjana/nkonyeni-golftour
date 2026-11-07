import Link from "next/link";
import { Button, Card, Field, Flash, inputCls } from "@/components/ui";
import { currentTour } from "@/lib/current";
import { addCourse, saveCourse } from "../actions";

export const dynamic = "force-dynamic";

const cell = "h-9 w-full min-w-0 rounded-lg border border-[#d8dce3] bg-white text-center text-sm";

export default async function AdminCoursesPage({ searchParams }: { searchParams: Promise<{ course?: string; saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const tour = await currentTour();
  const c = tour.courses.find((x) => x.course.id === sp.course) ?? tour.courses[0];

  return (
    <>
      {sp.saved && <Flash>Course saved.</Flash>}
      {sp.error && <Flash tone="red">Check the holes: par 3–6, and stroke index 1–18 used exactly once.</Flash>}
      {tour.courses.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {tour.courses.map((x) => (
            <Link key={x.course.id} href={`/admin/courses?course=${x.course.id}`} className={`rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${x === c ? "bg-navy text-white" : "bg-white"}`}>
              {x.course.name}
            </Link>
          ))}
        </div>
      )}
      {c && (
        <form action={saveCourse.bind(null, c.course.id)} className="flex flex-col gap-3">
          <Card>
            <div className="flex items-end gap-2.5">
              <Field label="Course" className="flex-1">
                <input name="name" defaultValue={c.course.name} className={inputCls} />
              </Field>
              <span className="pb-3 text-xs text-muted">Par {c.par}</span>
            </div>
            <div className="grid grid-cols-[1fr_64px_64px_44px] items-center gap-2 text-[11px] font-bold text-muted">
              <span>Tee</span>
              <span>Rating</span>
              <span>Slope</span>
              <span>Default</span>
              {c.tees.map((t) => {
                const len = (JSON.parse(t.lengths) as number[]).reduce((a, b) => a + b, 0);
                return (
                  <div key={t.id} className="contents">
                    <span className="flex flex-col gap-0.5">
                      <input name={`tee_${t.id}_name`} defaultValue={t.name} aria-label="Tee name" className={`${cell} text-left px-2 font-semibold text-navy`} />
                      {len > 0 && <span className="font-normal">{len} m</span>}
                    </span>
                    <input name={`tee_${t.id}_rating`} defaultValue={t.rating} inputMode="decimal" aria-label={`${t.name} rating`} className={cell} />
                    <input name={`tee_${t.id}_slope`} defaultValue={t.slope} inputMode="numeric" aria-label={`${t.name} slope`} className={cell} />
                    <input type="radio" name="default_tee" value={t.id} defaultChecked={!!t.is_default} aria-label={`${t.name} is default`} className="h-5 w-5 justify-self-center" />
                  </div>
                );
              })}
            </div>
          </Card>
          <Card className="!gap-0 overflow-hidden !p-0">
            <div className="grid grid-cols-6 gap-1.5 bg-[#edeae3] px-2.5 py-1.5 text-center text-[11px] font-bold text-[#3a4352]">
              <span>Hole</span><span>Par</span><span>SI</span><span>Hole</span><span>Par</span><span>SI</span>
            </div>
            {Array.from({ length: 9 }, (_, i) => {
              const f = c.holes[i];
              const b = c.holes[i + 9];
              return (
                <div key={i} className="grid grid-cols-6 items-center gap-1.5 border-t border-[#f0ede6] px-2.5 py-1 text-center text-sm">
                  <span className="font-bold">{i + 1}</span>
                  <input name={`par${i + 1}`} defaultValue={f?.par} inputMode="numeric" aria-label={`Hole ${i + 1} par`} className={cell} />
                  <input name={`si${i + 1}`} defaultValue={f?.si} inputMode="numeric" aria-label={`Hole ${i + 1} stroke index`} className={cell} />
                  <span className="border-l border-[#edeae3] font-bold">{i + 10}</span>
                  <input name={`par${i + 10}`} defaultValue={b?.par} inputMode="numeric" aria-label={`Hole ${i + 10} par`} className={cell} />
                  <input name={`si${i + 10}`} defaultValue={b?.si} inputMode="numeric" aria-label={`Hole ${i + 10} stroke index`} className={cell} />
                </div>
              );
            })}
          </Card>
          <Button type="submit">Save course</Button>
        </form>
      )}
      <Card>
        <details>
          <summary className="cursor-pointer text-sm font-bold text-[#1d5bbf]">+ Add course</summary>
          <form action={addCourse} className="mt-3 flex gap-2">
            <input name="name" placeholder="Course name" required className={inputCls} />
            <Button type="submit">Add</Button>
          </form>
        </details>
      </Card>
    </>
  );
}
