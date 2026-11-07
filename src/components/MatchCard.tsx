import Link from "next/link";
import type { TeamRow } from "@/lib/db/types";
import { fmtPts } from "@/lib/scoring";
import type { HoleCell, MatchView } from "@/lib/tour";

export function HoleStrip({ holes, teams }: { holes: HoleCell[]; teams: [TeamRow, TeamRow] }) {
  return (
    <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${holes.length}, minmax(0, 1fr))` }}>
      {holes.map((h) => {
        const style =
          h.result === "A" ? { background: teams[0].color } :
          h.result === "B" ? { background: teams[1].color } :
          h.result === "H" ? { background: "#b9c0cb" } : undefined;
        return (
          <span
            key={h.number}
            title={`Hole ${h.number}`}
            style={style}
            className={`flex h-[18px] items-center justify-center rounded text-[9px] font-bold ${
              h.locked ? "border border-dashed border-gold bg-gold-soft" : h.result ? "" : "bg-[#edeae3] text-[#6b7380]"
            }`}
          >
            {!h.result && !h.locked ? h.number : ""}
          </span>
        );
      })}
    </div>
  );
}

export function MatchCard({ m, teams, label }: { m: MatchView; teams: [TeamRow, TeamRow]; label: string }) {
  const names = (side: MatchView["sideA"]) => side.map((e) => e.short).join(" & ");
  const status = m.thru === 0 ? "Not started" : m.thru === m.holes.length ? "Final" : `Thru ${m.thru}`;
  return (
    <Link href={`/match/${m.match.id}`} className="flex flex-col gap-3 rounded-2xl bg-white p-3.5 shadow-[0_1px_2px_rgba(11,31,58,0.08)] active:scale-[0.99]">
      <div className="flex justify-between text-xs font-semibold text-muted">
        <span>{label}</span>
        <span>{status}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className="text-sm leading-snug font-semibold" style={{ color: teams[0].color }}>{names(m.sideA)}</span>
        <span className="font-display text-3xl font-bold whitespace-nowrap">
          {fmtPts(m.points.a)} <span className="text-halved">–</span> {fmtPts(m.points.b)}
        </span>
        <span className="text-right text-sm leading-snug font-semibold" style={{ color: teams[1].color }}>{names(m.sideB)}</span>
      </div>
      <HoleStrip holes={m.holes} teams={teams} />
    </Link>
  );
}
