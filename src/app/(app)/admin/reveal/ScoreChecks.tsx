"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { resolveScore } from "../actions";

export interface CheckValue {
  strokes: number;
  /** the people whose latest card shows this value */
  names: string[];
}

export interface CheckItem {
  key: string;
  matchId: string;
  entityId: string;
  hole: number;
  title: string;
  entityLabel: string;
  /** the score that currently counts (undefined if the card has no entry yet) */
  counting: number | undefined;
  values: CheckValue[];
  /** the player's counting score on every hole of the match */
  card: { number: number; strokes: number | undefined }[];
}

const valLabel = (v: number) => (v === 0 ? "Pick-up" : String(v));
const cellLabel = (v: number) => (v === 0 ? "X" : String(v));

/**
 * Score checks, one conflict at a time: a one-line card for the player in
 * question (conflicting hole in red), radios with the two disputed values,
 * and a Resolve button. Settling turns the cell green, then the row slides
 * away after a second so the next conflict can be resolved.
 */
export function ScoreChecks({ conflicts }: { conflicts: CheckItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, number>>(() =>
    Object.fromEntries(conflicts.map((c) => [c.key, c.counting ?? c.values[0]?.strokes ?? 0])),
  );
  const [resolved, setResolved] = useState<Record<string, number>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const settled = useRef<Set<string>>(new Set());
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // A conflict we settled disappears from the server's list after router.refresh().
  // If it later re-opens (someone enters a different score after the ruling), the
  // stale green/dismissed/selected state must be forgotten so it renders fresh.
  useEffect(() => {
    const present = new Set(conflicts.map((c) => c.key));
    const reopened = [...settled.current].filter((k) => present.has(k));
    if (!reopened.length) return;
    reopened.forEach((k) => settled.current.delete(k));
    setDismissed((p) => {
      const n = new Set(p);
      reopened.forEach((k) => n.delete(k));
      return n.size === p.size ? p : n;
    });
    setResolved((p) => {
      const n = { ...p };
      reopened.forEach((k) => delete n[k]);
      return n;
    });
    setSelected((p) => {
      const n = { ...p };
      reopened.forEach((k) => delete n[k]);
      return n;
    });
  }, [conflicts]);

  const valueFor = (c: CheckItem) => selected[c.key] ?? c.counting ?? c.values[0]?.strokes ?? 0;

  const settle = async (c: CheckItem) => {
    const strokes = valueFor(c);
    if (resolved[c.key] !== undefined || busy.has(c.key)) return;
    setBusy((p) => new Set(p).add(c.key));
    setError(null);
    try {
      const r = await resolveScore(c.matchId, c.entityId, c.hole, strokes);
      if (!r?.ok) throw new Error("Resolve failed");
      settled.current.add(c.key);
      setResolved((p) => ({ ...p, [c.key]: strokes }));
      timers.current.push(
        window.setTimeout(() => {
          setDismissed((p) => new Set(p).add(c.key));
          setBusy((p) => {
            const next = new Set(p);
            next.delete(c.key);
            return next;
          });
          router.refresh();
        }, 1000),
      );
    } catch {
      setError("Couldn't save that score — check your connection and try again.");
      setBusy((p) => {
        const next = new Set(p);
        next.delete(c.key);
        return next;
      });
    }
  };

  const rows = conflicts.filter((c) => !dismissed.has(c.key));

  return (
    <section className="flex flex-col gap-2.5 rounded-[20px] bg-white p-4 text-navy">
      <div className="flex items-center justify-between">
        <span className="text-base font-bold">Score checks</span>
        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${rows.length ? "bg-[#fcebee] text-[#8e0b20]" : "bg-[#e3f4ea] text-[#17643a]"}`}>
          {rows.length ? `${rows.length} to check` : "All cards agree"}
        </span>
      </div>
      {error && <p role="alert" className="rounded-lg bg-[#fcebee] px-3 py-2 text-sm text-[#8e0b20]">{error}</p>}
      {rows.length === 0 ? (
        <p className="text-xs text-muted">
          Anyone in a group can keep the card. When two phones enter different scores for the same hole, it shows up here so you can settle it before the reveal.
        </p>
      ) : (
        <>
          {rows.map((c) => {
            const chosen = resolved[c.key];
            return (
              <div key={c.key} className="flex flex-col gap-2 border-t border-[#f0ede6] pt-2.5">
                <span className="text-sm font-bold">{c.title}</span>
                <span className="text-xs text-muted">Score for {c.entityLabel}</span>

                {/* One-line scorecard for this player */}
                <div className="flex gap-1 overflow-x-auto pb-0.5">
                  {c.card.map((cell) => {
                    const isConflict = cell.number === c.hole;
                    const bg = isConflict ? (chosen !== undefined ? "bg-[#17643a]" : "bg-[#8e0b20]") : "bg-sand";
                    const text = isConflict || chosen !== undefined ? "text-white" : "text-navy";
                    return (
                      <div key={cell.number} className={`flex h-9 w-6.5 flex-none flex-col items-center justify-center rounded-md ${bg} ${text}`}>
                        <span className="text-[8px] leading-none opacity-70">{cell.number}</span>
                        <span className="text-[13px] leading-tight font-bold">
                          {isConflict && chosen !== undefined ? cellLabel(chosen) : cell.strokes === undefined ? "–" : cellLabel(cell.strokes)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* The disputed values */}
                <div className="flex flex-wrap gap-2">
                  {c.values.map((v) => {
                    const active = valueFor(c) === v.strokes;
                    return (
                      <label
                        key={v.strokes}
                        className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-2.5 ${active ? "border-navy bg-navy text-white" : "border-[#d8dce3] bg-white text-navy"}`}
                      >
                        <input
                          type="radio"
                          name={c.key}
                          value={v.strokes}
                          checked={active}
                          onChange={() => setSelected((p) => ({ ...p, [c.key]: v.strokes }))}
                          className="accent-gold"
                          disabled={chosen !== undefined}
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="text-sm font-bold">
                            {valLabel(v.strokes)}
                            {v.strokes === c.counting && <span className="ml-1 text-[10px] font-semibold opacity-70">counting now</span>}
                          </span>
                          <span className="truncate text-[10px] opacity-70">{v.names.join(", ")}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => settle(c)}
                  disabled={chosen !== undefined || busy.has(c.key)}
                  className={`h-11 rounded-[10px] text-sm font-bold disabled:opacity-50 ${chosen !== undefined ? "bg-[#e3f4ea] text-[#17643a]" : "bg-gold text-navy"}`}
                >
                  {chosen !== undefined ? "Settled ✓" : busy.has(c.key) ? "Settling…" : "Resolve"}
                </button>
              </div>
            );
          })}
          <p className="text-xs text-muted">
            Tap the score that counts, then Resolve. The red cell shows what the live tally uses until you settle it.
          </p>
        </>
      )}
    </section>
  );
}
