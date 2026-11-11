import { buildChecklist } from "@/lib/checklist";
import { currentTour } from "@/lib/current";
import { Checklist } from "./Checklist";

export const dynamic = "force-dynamic";

export default async function ChecklistPage() {
  const tour = await currentTour();
  const sections = buildChecklist({
    days: tour.days.map((d) => ({
      id: d.day.id,
      number: d.day.number,
      date: d.day.date,
      course: d.course.course.name,
      sessions: d.sessions.map((s) => ({
        id: s.session.id,
        slot: s.session.slot,
        format: s.session.format,
        holes: s.session.holes,
        teeTime: s.session.tee_time,
        pairingDeadline: s.session.pairing_deadline,
      })),
    })),
  });
  return <Checklist eventId={tour.event.id} sections={sections} />;
}
