import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { BackIcon, LockIcon } from "@/components/icons";
import { currentTour } from "@/lib/current";
import { ALLOWANCE, fmtPts } from "@/lib/scoring";
import { sessionTitle } from "@/lib/view";

export const dynamic = "force-dynamic";

const initials = (name: string) => name.split(/[\s&]+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 3).toUpperCase();

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tour = await currentTour();
  const session = tour.sessions.find((s) => s.matches.some((m) => m.match.id === id));
  const m = session?.matches.find((x) => x.match.id === id);
  if (!session || !m) notFound();
  const [ta, tb] = tour.teams;
  const entities = [...m.sideA.map((e) => ({ e, team: ta })), ...m.sideB.map((e) => ({ e, team: tb }))];
  const cols = `34px 28px 28px repeat(${entities.length}, minmax(0, 1fr)) 40px`;
  const status = m.thru === m.holes.length ? "Final" : `thru ${m.thru}`;

  return (
    <div className="flex flex-col">
      <header className="flex flex-col gap-2.5 bg-navy px-4 pt-3.5 pb-4 text-white">
        <div className="flex items-center gap-2.5">
          <Link href="/live" aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
            <BackIcon size={18} />
          </Link>
          <div className="flex flex-col">
            <span className="text-[15px] font-bold">Match {m.match.match_no} · {sessionTitle(session).split(" · ").at(-1)}</span>
            <span className="text-xs text-mist">
              Day {session.day.number} {session.session.slot === "AM" ? "morning" : "afternoon"} · {status} · {Math.round(ALLOWANCE[session.session.format] * 100)}% allowance
            </span>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="text-[13px] leading-snug font-semibold">{m.sideA.map((e) => e.label).join(" & ")}</span>
          <span className="font-display text-4xl leading-none font-bold">
            {fmtPts(m.points.a)} <span className="text-halved">–</span> {fmtPts(m.points.b)}
          </span>
          <span className="text-right text-[13px] leading-snug font-semibold">{m.sideB.map((e) => e.label).join(" & ")}</span>
        </div>
      </header>

      <div className="flex flex-col gap-1.5 px-3 py-2.5">
        <div className="grid items-end gap-0.5 px-0.5 text-center text-[11px] font-bold text-muted" style={{ gridTemplateColumns: cols }}>
          <span>Hole</span>
          <span>Par</span>
          <span>SI</span>
          {entities.map(({ e, team }) => (
            <span key={e.id} style={{ color: team.color }} title={e.label}>
              {initials(e.label)}
              <br />
              {e.strokes}
            </span>
          ))}
          <span>Pt</span>
        </div>
        <div className="flex flex-col overflow-hidden rounded-xl bg-white">
          {m.holes.map((h) => {
            const grosses = [...h.grossA, ...h.grossB];
            const received = [...h.receivedA, ...h.receivedB];
            const nets = grosses.map((g, i) => (g === undefined ? undefined : g === 0 ? Infinity : g - received[i]));
            const bestA = Math.min(...nets.slice(0, m.sideA.length).map((n) => n ?? Infinity));
            const bestB = Math.min(...nets.slice(m.sideA.length).map((n) => n ?? Infinity));
            return (
              <div
                key={h.number}
                className={`grid h-[30px] items-center gap-0.5 border-t border-[#f0ede6] px-0.5 text-center text-[13px] ${h.locked ? "bg-gold-soft" : ""}`}
                style={{ gridTemplateColumns: cols }}
              >
                <span className="font-bold">{h.number}</span>
                <span className="text-muted">{h.par}</span>
                <span className="text-muted">{h.si}</span>
                {grosses.map((g, i) => {
                  const best = i < m.sideA.length ? bestA : bestB;
                  const counted = h.result && m.sideA.length + m.sideB.length > 2 && nets[i] === best && best !== Infinity;
                  return (
                    <span key={i} className={counted ? "rounded-md bg-[#e8eef9] leading-6 font-bold" : g === undefined ? "text-[#b0b6c0]" : "text-muted"}>
                      {h.locked ? "" : g === undefined ? "–" : g === 0 ? "X" : g}
                      {received[i] > 0 && <sup className="text-[8px] text-gold-ink">{"•".repeat(received[i])}</sup>}
                    </span>
                  );
                })}
                {h.locked ? (
                  <span className="flex justify-center text-gold-ink"><LockIcon size={14} /></span>
                ) : h.result ? (
                  <span
                    className="rounded-md text-xs leading-[22px] font-bold text-white"
                    style={{ background: h.result === "A" ? ta.color : h.result === "B" ? tb.color : "#8a93a1" }}
                  >
                    {h.result === "H" ? "½" : initials(h.result === "A" ? ta.name : tb.name).slice(0, 2)}
                  </span>
                ) : (
                  <span />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3 px-0.5 text-[11px] text-muted">
          <span><sup className="text-gold-ink">•</sup> stroke received</span>
          <span>X picked up</span>
          {m.sideA.length > 1 && (
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-[3px] bg-[#e8eef9] outline outline-[#9fb6e0]" /> ball that counted
            </span>
          )}
          <span className="ml-auto"><AutoRefresh /></span>
        </div>
      </div>
    </div>
  );
}
