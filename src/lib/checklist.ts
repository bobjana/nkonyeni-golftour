// Pure organizer checklist: turns the event schedule into time-stamped items.
// The client strikes items through once their time passes and lets the
// organizer tick the ones still ahead (see admin/checklist/Checklist.tsx).
import type { Format } from "./db/types";

export interface ChecklistSessionInput {
  id: string;
  slot: "AM" | "PM";
  format: Format;
  holes: number;
  /** HH:MM */
  teeTime: string;
  /** HH:MM, optional deadline shown to captains */
  pairingDeadline: string | null;
}

export interface ChecklistDayInput {
  id: string;
  number: number;
  /** YYYY-MM-DD */
  date: string;
  course: string;
  sessions: ChecklistSessionInput[];
}

export interface ChecklistInput {
  days: ChecklistDayInput[];
}

export interface ChecklistItem {
  /** stable key for persisting the manual check (e.g. "<dayId>|<sessionId>|open") */
  id: string;
  label: string;
  /** wall-clock date + time; null = no time, always checkable */
  at: { date: string; time: string } | null;
  href: string | null;
  note?: string;
}

export interface ChecklistSection {
  id: string;
  title: string;
  subtitle: string | null;
  items: ChecklistItem[];
}

/** Estimated minutes a round takes, used for the "scores in" and reveal times. */
export const roundMinutes = (holes: number) => (holes === 18 ? 270 : 150);

/** Shifts an HH:MM time by minutes (may wrap past midnight). */
export function shiftTime(time: string, deltaMinutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const t = ((h * 60 + m + deltaMinutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** "2026-11-13" → "Fri 13 Nov" */
export function fmtDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

export function buildChecklist(input: ChecklistInput): ChecklistSection[] {
  const sections: ChecklistSection[] = [
    {
      id: "setup",
      title: "Before the tour",
      subtitle: "One-time setup — tick these any time",
      items: [
        { id: "setup:invites", label: "Send every player their invite link", at: null, href: "/admin/teams" },
        { id: "setup:players", label: "Check names, emails and handicap indexes", at: null, href: "/admin/teams" },
        { id: "setup:event", label: "Event settings: password and hidden holes", at: null, href: "/admin" },
        { id: "setup:courses", label: "Verify courses: par, stroke index and tees", at: null, href: "/admin/courses" },
        { id: "setup:demo", label: "Dry run with Demo mode", at: null, href: "/admin/demo", note: "Starting a demo wipes pairings, scores and reveals" },
        { id: "setup:deploy", label: "Deploy with APP_URL set and DEMO_DISABLED=1", at: null, href: null },
      ],
    },
  ];

  for (const day of input.days) {
    const items: ChecklistItem[] = [];
    for (const s of day.sessions) {
      const slot = s.slot === "AM" ? "morning" : "afternoon";
      const when = (time: string) => ({ date: day.date, time });
      items.push(
        {
          id: `${day.id}|${s.id}|open`,
          label: `Open pairings to captains — ${slot}`,
          at: when(s.pairingDeadline ?? shiftTime(s.teeTime, -90)),
          href: `/admin/sessions/${s.id}`,
        },
        {
          id: `${day.id}|${s.id}|publish`,
          label: `Publish draw & go live — ${slot}`,
          at: when(shiftTime(s.teeTime, -30)),
          href: `/admin/sessions/${s.id}`,
        },
        {
          id: `${day.id}|${s.id}|tee`,
          label: `Tee-off — ${slot}`,
          at: when(s.teeTime),
          href: `/admin/sessions/${s.id}`,
        },
        {
          id: `${day.id}|${s.id}|done`,
          label: `Scores in — ${slot} complete (estimate)`,
          at: when(shiftTime(s.teeTime, roundMinutes(s.holes))),
          href: `/admin/sessions/${s.id}`,
        },
      );
    }
    const last = day.sessions.at(-1);
    if (last) {
      items.push({
        id: `${day.id}|reveal`,
        label: "Resolve score checks & Reveal to everyone",
        at: { date: day.date, time: shiftTime(last.teeTime, roundMinutes(last.holes) + 30) },
        href: `/admin/reveal?day=${day.id}`,
      });
    }
    // Run-of-show order: every day item has a time, so sort by it.
    items.sort((a, b) => (a.at!.time === b.at!.time ? a.label.localeCompare(b.label) : a.at!.time.localeCompare(b.at!.time)));
    sections.push({
      id: day.id,
      title: `Day ${day.number}`,
      subtitle: `${fmtDate(day.date)} · ${day.course}`,
      items,
    });
  }
  return sections;
}
