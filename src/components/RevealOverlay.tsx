"use client";

import { useEffect, useState } from "react";
import { fmtPts } from "@/lib/scoring";

type Pts = { a: number; b: number };

/** Full-screen drumroll → result, shown once per device after the organizer reveals a day. */
export function RevealOverlay({
  dayKey,
  revealedAt,
  dayNumber,
  teams,
  day,
  tour,
}: {
  dayKey: string;
  revealedAt: string;
  dayNumber: number;
  teams: { name: string; color: string }[];
  day: Pts;
  tour: Pts;
}) {
  const [phase, setPhase] = useState<"hidden" | "drum" | "result">("hidden");

  useEffect(() => {
    const fresh = Date.now() - new Date(revealedAt).getTime() < 12 * 3600 * 1000;
    let seen = false;
    try {
      seen = localStorage.getItem(`reveal:${dayKey}`) === "1";
    } catch {}
    if (!fresh || seen) return;
    setPhase("drum");
    const t = setTimeout(() => setPhase("result"), 3200);
    return () => clearTimeout(t);
  }, [dayKey, revealedAt]);

  if (phase === "hidden") return null;
  const close = () => {
    try {
      localStorage.setItem(`reveal:${dayKey}`, "1");
    } catch {}
    setPhase("hidden");
  };
  const winner = day.a === day.b ? null : day.a > day.b ? teams[0] : teams[1];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-navy-deep px-6 text-center text-white" role="dialog" aria-modal="true" aria-label={`Day ${dayNumber} reveal`}>
      <span className="font-display text-lg font-bold tracking-[4px] text-gold">DAY {dayNumber}</span>
      <h1 className="font-display text-5xl leading-none font-bold">GRAND REVEAL</h1>
      {phase === "drum" ? (
        <div className="flex flex-col items-center gap-4">
          <div className="animate-drum h-24 w-24 rounded-full border-4 border-gold" />
          <p className="text-mist">The hidden holes are coming in…</p>
        </div>
      ) : (
        <div className="animate-pop flex w-full max-w-sm flex-col gap-5">
          <p className="text-lg font-semibold">{winner ? `${winner.name} win the day!` : "The day is halved!"}</p>
          <div className="grid grid-cols-2 gap-3">
            {teams.map((t, i) => (
              <div key={t.name} className="flex flex-col gap-1 rounded-2xl p-4" style={{ background: t.color }}>
                <span className="text-xs font-semibold tracking-wider uppercase">{t.name}</span>
                <span className="font-display text-6xl leading-none font-bold">{fmtPts(i ? day.b : day.a)}</span>
                <span className="text-xs opacity-90">Tour: {fmtPts(i ? tour.b : tour.a)}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={close} className="h-14 rounded-2xl bg-gold text-base font-bold text-navy">
            See the standings
          </button>
        </div>
      )}
    </div>
  );
}
