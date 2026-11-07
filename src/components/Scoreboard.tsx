import type { TeamRow } from "@/lib/db/types";
import { fmtPts } from "@/lib/scoring";

export function Scoreboard({
  teams,
  points,
  available,
  caption,
  footer,
}: {
  teams: [TeamRow, TeamRow];
  points: { a: number; b: number };
  available: number;
  caption: string;
  footer?: React.ReactNode;
}) {
  const pct = (x: number) => (available ? `${Math.min(50, (x / available) * 100)}%` : "0%");
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: teams[0].color }} />
            {teams[0].name}
          </span>
          <span className="font-display text-6xl leading-none font-bold">{fmtPts(points.a)}</span>
        </div>
        <span className="pb-2 text-center text-xs text-mist">{caption}</span>
        <div className="flex flex-col items-end gap-0.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            {teams[1].name}
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: teams[1].color }} />
          </span>
          <span className="font-display text-6xl leading-none font-bold">{fmtPts(points.b)}</span>
        </div>
      </div>
      <div className="relative flex h-2.5 overflow-hidden rounded-full bg-white/15">
        <div style={{ width: pct(points.a), background: teams[0].color, filter: "brightness(1.25)" }} />
        <div className="flex-1" />
        <div style={{ width: pct(points.b), background: teams[1].color, filter: "brightness(1.25)" }} />
        <div className="absolute top-0 left-1/2 h-full w-0.5 -translate-x-1/2 bg-gold" />
      </div>
      {footer}
    </div>
  );
}
