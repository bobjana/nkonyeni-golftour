import type { SessionRow, TeamRow } from "./db/types";
import { FORMAT_LABEL } from "./scoring";
import type { DayView, SessionView, Tour } from "./tour";

export const slotLabel = (s: SessionRow) => (s.slot === "AM" ? "Morning" : "Afternoon");

export function sessionTitle(s: SessionView): string {
  return `Day ${s.day.number} · ${slotLabel(s.session)} · ${FORMAT_LABEL[s.session.format]}`;
}

export function sessionDetail(s: SessionView): string {
  const holes = s.session.holes === 18 ? "18 holes" : `9 holes (${s.session.nine})`;
  return `${holes} · tee-off ${s.session.tee_time}`;
}

export function dayDate(d: DayView): string {
  return new Date(`${d.day.date}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

/** Points needed to win outright. */
export const toWin = (t: Tour) => t.available / 2 + 0.5;

export const teamOf = (t: Tour, teamId: string): TeamRow | undefined => t.teams.find((x) => x.id === teamId);
