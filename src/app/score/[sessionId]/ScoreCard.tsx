"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackIcon, CheckIcon, LockIcon, OfflineIcon } from "@/components/icons";
import type { Format } from "@/lib/db/types";
import { bestNet, fmtPts, holeWinner, pointsFor, type HoleWinner } from "@/lib/scoring";

export interface CardEntity {
  id: string;
  label: string;
  strokes: number;
  teeOrder: string[];
  received: Record<number, number>;
}

export interface CardMatch {
  id: string;
  matchNo: number;
  sideA: CardEntity[];
  sideB: CardEntity[];
  scores: Record<string, Record<number, number>>;
}

type HoleInfo = { number: number; par: number; si: number; length?: number };
type Entry = { matchId: string; entityId: string; hole: number; strokes: number; at: string };
type Scores = Record<string, Record<string, Record<number, number>>>; // match → entity → hole → gross

const queueKey = (sessionId: string) => `golftour:pending:${sessionId}`;
const capturedKey = (sessionId: string) => `golftour:captured:${sessionId}`;

const readQueue = (k: string): Entry[] => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? "[]");
  } catch {
    return [];
  }
};
const writeQueue = (k: string, q: Entry[]) => {
  try {
    localStorage.setItem(k, JSON.stringify(q));
  } catch {}
};
const readCaptured = (k: string): Scores => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? "{}");
  } catch {
    return {};
  }
};
const writeCaptured = (k: string, c: Scores) => {
  try {
    localStorage.setItem(k, JSON.stringify(c));
  } catch {}
};

/**
 * Gross-stroke decoration based on difference from par.
 * Decorations are purely cosmetic — hole winners are determined by net score.
 */
function decorationStyle(gross: number, par: number): Record<string, string> | null {
  if (gross === 0) return null; // picked up — X, no decoration
  const diff = gross - par;
  if (diff === 0) return null; // par — no decoration
  const color = diff < 0 ? "#2e8545" : "#cd3d3d"; // green (birdie/eagle) / red (bogey/double)
  const count = Math.min(Math.abs(diff), 2); // cap at 2
  const borderRadius = diff < 0 ? "9999px" : "0"; // circle for under, square for over
  const base: Record<string, string> = { border: `2px solid ${color}`, borderRadius };
  if (count === 2) {
    // Double border: box-shadow creates the second ring
    base.boxShadow = `0 0 0 3px ${color}`;
  }
  return base;
}

export function ScoreCard({
  sessionId,
  title,
  format,
  teeName,
  holes,
  hidden,
  teams,
  matches,
  savedBy,
  tally,
}: {
  sessionId: string;
  title: string;
  format: Format;
  teeName: string;
  holes: HoleInfo[];
  hidden: number[];
  teams: { name: string; color: string }[];
  matches: CardMatch[];
  /** first name of whoever last saved each hole ("you" for this player) */
  savedBy: Record<number, string>;
  /** what this player can see of the team tally right now */
  tally: { tour: { a: number; b: number }; session: { a: number; b: number } };
}) {
  const router = useRouter();
  const qk = queueKey(sessionId);
  const ck = capturedKey(sessionId);

  // ── Server + pending ground truth ──────────────────────────────────
  const [scores, setScores] = useState<Scores>(() => Object.fromEntries(matches.map((m) => [m.id, structuredClone(m.scores)])));
  const entitiesOf = (m: CardMatch) => [...m.sideA, ...m.sideB];
  const entityIdsOf = (m: CardMatch) => entitiesOf(m).map((e) => e.id);
  const holeDone = useCallback(
    (s: Scores, hole: number) => matches.every((m) => entityIdsOf(m).every((e) => s[m.id]?.[e]?.[hole] !== undefined)),
    [matches],
  );
  const firstOpen = (s: Scores) => {
    const i = holes.findIndex((h) => !holeDone(s, h.number));
    return i === -1 ? holes.length : i;
  };
  const [idx, setIdx] = useState(() => firstOpen(scores));
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Local capture state (persistent in localStorage) ────────────────
  const [captured, setCapturedImpl] = useState<Scores>(() => readCaptured(ck));
  const setCaptured = (next: Scores) => {
    setCapturedImpl(next);
    writeCaptured(ck, next);
  };

  // ── Dirty-holes tracking (in-memory; reset on save) ─────────────────
  const [dirtyHoles, setDirtyHoles] = useState<Set<number>>(new Set());

  // ── Publish notification state ──────────────────────────────────────
  const [pubNotice, setPubNotice] = useState<number | null>(null); // hole number just published
  const advanceKey = `golftour:advance:${sessionId}`; // localStorage shared cancel state

  // ── Flush (same as before) ─────────────────────────────────────────
  const flush = useCallback(async () => {
    const q = readQueue(qk);
    setPending(q.length);
    if (!q.length || !navigator.onLine) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries: q }) });
      if (res.ok) {
        const sent = new Set(q.map((e) => `${e.matchId}|${e.entityId}|${e.hole}|${e.at}`));
        const left = readQueue(qk).filter((e) => !sent.has(`${e.matchId}|${e.entityId}|${e.hole}|${e.at}`));
        writeQueue(qk, left);
        setPending(left.length);
        setError(null);
        router.refresh();
      } else {
        setError((await res.json().catch(() => ({})))?.error ?? `Sync failed (${res.status})`);
      }
    } catch {
      // offline or flaky signal: keep the queue and retry
    } finally {
      setSyncing(false);
    }
  }, [qk, router]);

  // ── Is an entity captured for a hole? ──────────────────────────────
  const isCaptured = useCallback(
    (matchId: string, entityId: string, hole: number): boolean => {
      if (scores[matchId]?.[entityId]?.[hole] !== undefined) return true; // server has it
      if (captured[matchId]?.[entityId]?.[hole] !== undefined) return true; // we captured it
      return false;
    },
    [scores, captured],
  );

  const allOnHoleCaptured = useCallback(
    (hole: number): boolean => matches.every((m) => entityIdsOf(m).every((e) => isCaptured(m.id, e, hole))),
    [matches, isCaptured],
  );

  // ── Get the effective strokes for an entity on a hole ───────────────
  const getStrokes = (matchId: string, entityId: string, holeNumber: number): number => {
    // Priority: pending/scores > captured > par
    const sv = scores[matchId]?.[entityId]?.[holeNumber];
    if (sv !== undefined) return sv;
    const cv = captured[matchId]?.[entityId]?.[holeNumber];
    if (cv !== undefined) return cv;
    const hole = holes.find((h) => h.number === holeNumber);
    return hole?.par ?? 1;
  };

  // ── Capture a score ─────────────────────────────────────────────────
  const capture = (matchId: string, entityId: string, strokes: number) => {
    const next = structuredClone(captured);
    ((next[matchId] ??= {})[entityId] ??= {})[hole.number] = strokes;
    setCaptured(next);
  };

  // ── Bump (same logic, but also marks captured + dirty) ─────────────
  const bump = (matchId: string, entityId: string, d: number) => {
    const cur = getStrokes(matchId, entityId, hole.number);
    const next = cur === 0 ? (d > 0 ? hole.par : hole.par - 1) : Math.max(1, Math.min(15, cur + d));
    capture(matchId, entityId, next);
    setDirtyHoles((prev) => new Set(prev).add(hole.number));
  };

  // ── Pick-up toggle ─────────────────────────────────────────────────
  const pickUp = (matchId: string, entityId: string) => {
    const cur = getStrokes(matchId, entityId, hole.number);
    capture(matchId, entityId, cur === 0 ? hole.par : 0);
    setDirtyHoles((prev) => new Set(prev).add(hole.number));
  };

  // ── Accept par on grey score click ──────────────────────────────────
  const acceptPar = (matchId: string, entityId: string) => {
    if (!isCaptured(matchId, entityId, hole.number)) {
      capture(matchId, entityId, hole.par);
      setDirtyHoles((prev) => new Set(prev).add(hole.number));
    }
  };

  // ── Save / Publish ──────────────────────────────────────────────────
  const save = () => {
    // Already saved on server AND no local changes → nothing to do
    if (holeDone(scores, hole.number) && !dirtyHoles.has(hole.number)) return;

    const at = new Date().toISOString();
    const entries: Entry[] = matches.flatMap((m) =>
      entityIdsOf(m).map((e) => ({
        matchId: m.id,
        entityId: e,
        hole: hole.number,
        strokes: getStrokes(m.id, e, hole.number),
        at,
      })),
    );

    // Update in-memory scores
    const next = structuredClone(scores);
    for (const e of entries) ((next[e.matchId] ??= {})[e.entityId] ??= {})[e.hole] = e.strokes;
    setScores(next);

    // Push to pending queue
    writeQueue(qk, [...readQueue(qk), ...entries]);
    setPending(readQueue(qk).length);
    flush();

    // Mark hole clean
    const nextDirty = new Set(dirtyHoles);
    nextDirty.delete(hole.number);
    setDirtyHoles(nextDirty);

    // Show publish notification + schedule auto-advance (unless cancelled)
    const savedHole = hole.number;
    setPubNotice(savedHole);
    localStorage.setItem(advanceKey, JSON.stringify({ hole: savedHole, cancelled: false }));

    setTimeout(() => {
      const state = JSON.parse(localStorage.getItem(advanceKey) ?? "{}");
      if (state.hole === savedHole && !state.cancelled) {
        localStorage.removeItem(advanceKey);
        setPubNotice(null);
        const after = holes.findIndex((h, i) => i > idx && !holeDone(scores, h.number));
        setIdx(after === -1 ? (holes.every((h) => holeDone(scores, h.number)) ? holes.length : idx + 1) : after);
      }
    }, 5000);
  };

  const cancelPub = () => {
    localStorage.setItem(advanceKey, JSON.stringify({ hole: pubNotice, cancelled: true }));
    setPubNotice(null);
  };

  // ── Sync plumbing (same as before) ─────────────────────────────────
  useEffect(() => {
    const q = readQueue(qk);
    if (q.length) {
      setScores((prev) => {
        const next = structuredClone(prev);
        for (const e of q) ((next[e.matchId] ??= {})[e.entityId] ??= {})[e.hole] = e.strokes;
        setIdx(firstOpen(next));
        return next;
      });
    }
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      flush();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const t = setInterval(() => {
      flush();
      if (document.visibilityState === "visible") router.refresh();
    }, 15000);
    flush();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flush, qk]);

  // ── Merge server scores into in-memory state on refresh ────────────
  useEffect(() => {
    const queued = new Set(readQueue(qk).map((e) => `${e.matchId}|${e.entityId}|${e.hole}`));
    setScores((prev) => {
      let changed = false;
      const next = structuredClone(prev);
      for (const m of matches)
        for (const [entityId, byHole] of Object.entries(m.scores))
          for (const [h, strokes] of Object.entries(byHole)) {
            const row = ((next[m.id] ??= {})[entityId] ??= {});
            const hole = Number(h);
            if (row[hole] !== strokes && !queued.has(`${m.id}|${entityId}|${hole}`)) {
              row[hole] = strokes;
              changed = true;
            }
          }
      if (!changed) return prev;
      if (!dirtyHoles.size) setIdx(firstOpen(next));
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, qk]);

  const done = idx >= holes.length;
  const hole = holes[Math.min(idx, holes.length - 1)];

  // ── Hole result helpers ─────────────────────────────────────────────
  const resultFor = (m: CardMatch, h: number): HoleWinner | null =>
    holeWinner(
      { gross: m.sideA.map((e) => getStrokes(m.id, e.id, h)), received: m.sideA.map((e) => e.received[h] ?? 0) },
      { gross: m.sideB.map((e) => getStrokes(m.id, e.id, h)), received: m.sideB.map((e) => e.received[h] ?? 0) },
    );

  const tallies = useMemo(
    () =>
      Object.fromEntries(
        matches.map((m) => {
          const before = holes.slice(0, Math.min(idx, holes.length)).map((h) => resultFor(m, h.number));
          return [m.id, { ...pointsFor(before), thru: before.filter(Boolean).length }];
        }),
      ),
    [matches, holes, idx, getStrokes],
  );

  // ── Visual helpers ──────────────────────────────────────────────────
  const show = (n: number | null) => (n === null || n === Infinity ? "X" : n);

  const big = format === "foursomes";

  // ── Status bar ──────────────────────────────────────────────────────
  const status = !online ? (
    <span className="flex items-center gap-1 text-[11px] text-[#ffd27a]">
      <OfflineIcon size={14} />
      Offline{pending ? ` · ${pending} saved on phone` : ""}
    </span>
  ) : pending || syncing ? (
    <span className="text-[11px] text-[#ffd27a]">Syncing {pending}…</span>
  ) : (
    <span className="flex items-center gap-1 text-[11px] text-[#9ee6bd]">
      <CheckIcon size={14} />
      Synced
    </span>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-3 bg-navy px-4 pt-3 pb-3.5 text-white">
        {/* ── Top tally bar ─────────────────────────────────────── */}
        <div className="-mx-4 -mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-navy-deep px-4 py-2">
          <span className="flex items-baseline gap-1.5 truncate">
            <span className="h-2 w-2 flex-none self-center rounded-full" style={{ background: teams[0].color }} />
            <span className="truncate text-[11px] font-semibold text-mist uppercase">{teams[0].name}</span>
            <span className="font-display text-xl font-bold">{fmtPts(tally.tour.a)}</span>
          </span>
          <span className="flex flex-col items-center leading-tight">
            <span className="text-[10px] font-bold tracking-wider text-gold">TOUR</span>
            <span className="text-[10px] text-mist">
              today {fmtPts(tally.session.a)}–{fmtPts(tally.session.b)}
            </span>
          </span>
          <span className="flex items-baseline justify-end gap-1.5 truncate">
            <span className="font-display text-xl font-bold">{fmtPts(tally.tour.b)}</span>
            <span className="truncate text-[11px] font-semibold text-mist uppercase">{teams[1].name}</span>
            <span className="h-2 w-2 flex-none self-center rounded-full" style={{ background: teams[1].color }} />
          </span>
        </div>

        {/* ── Live tally link + status ──────────────────────────── */}
        <div className="flex items-center justify-between gap-2">
          <Link href="/live" className="flex items-center gap-1 text-[13px] font-semibold">
            <BackIcon size={16} />
            Live tally
          </Link>
          <span className="truncate text-xs text-mist">{title}</span>
          {status}
        </div>

        {/* ── Hole header + progress strip ───────────────────────── */}
        {!done && (
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold tracking-wider text-gold">HOLE</span>
              <span className="font-display text-6xl leading-[0.9] font-bold">{hole.number}</span>
              {holeDone(scores, hole.number) ? (
                <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#9ee6bd]">
                  <CheckIcon size={12} />
                  Saved
                </span>
              ) : allOnHoleCaptured(hole.number) ? (
                <span className="mt-1 text-[11px] font-semibold text-gold-ink">Ready to save</span>
              ) : (
                <span className="mt-1 text-[11px] font-semibold text-[#ffd27a]">Not saved yet</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-center">
              <span className="text-[11px] text-mist">PAR</span>
              <span className="text-[11px] text-mist">SI</span>
              <span className="text-[11px] text-mist uppercase">{teeName}</span>
              <span className="font-display text-3xl font-bold">{hole.par}</span>
              <span className="font-display text-3xl font-bold">{hole.si}</span>
              <span className="font-display text-3xl font-bold">{hole.length ? `${hole.length}m` : "–"}</span>
            </div>
          </div>
        )}

        {/* ── Hole strip (gated in scorer mode) ─────────────────── */}
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${holes.length}, minmax(0, 1fr))` }}
        >
          {holes.map((h, i) => {
            const r = matches.length === 1 ? resultFor(matches[0], h.number) : null;
            const complete = holeDone(scores, h.number);
            const current = i === idx;
            const bg = current
              ? "#c9a227"
              : r === "A"
                ? teams[0].color
                : r === "B"
                  ? teams[1].color
                  : r === "H" || complete
                    ? "#8a93a1"
                    : "rgba(255,255,255,0.12)";
            // In scorer mode, only the current hole is clickable (gated).
            // After all holes are complete, all holes become clickable for review.
            const clickable = done || current;
            return (
              <button
                key={h.number}
                type="button"
                onClick={() => clickable && setIdx(i)}
                aria-label={`Hole ${h.number}`}
                className={`flex h-6 items-center justify-center rounded text-[10px] font-bold ${
                  hidden.includes(h.number) && !current ? "outline outline-1 outline-dashed outline-gold" : ""
                }`}
                style={{
                  background: bg,
                  color: current ? "#0b1f3a" : complete ? "#fff" : "#c7d0dd",
                  opacity: !clickable && !current ? "0.4" : undefined,
                  cursor: clickable ? "pointer" : "default",
                }}
              >
                {h.number}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Card complete ─────────────────────────────────────────── */}
      {done ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <CheckIcon size={48} className="text-[#17643a]" />
          <h1 className="text-xl font-bold">Card complete</h1>
          <p className="text-sm text-muted">
            {pending
              ? `${pending} scores still syncing. Keep the app open until you have signal.`
              : "All scores are in. Thanks for keeping score!"}
          </p>
          {matches.map((m) => {
            const all = pointsFor(holes.map((h) => resultFor(m, h.number)));
            return (
              <p key={m.id} className="font-display text-2xl font-bold">
                Match {m.matchNo}: <span style={{ color: teams[0].color }}>{fmtPts(all.a)}</span> –{" "}
                <span style={{ color: teams[1].color }}>{fmtPts(all.b)}</span>
              </p>
            );
          })}
          {/* In review mode (day complete), tapping the last hole navigates there */}
          <button
            type="button"
            onClick={() => setIdx(holes.length - 1)}
            className="text-sm font-semibold text-[#1d5bbf] underline"
          >
            Edit last hole
          </button>
          <Link href="/live" className="w-full rounded-2xl bg-navy py-4 font-bold text-white">
            Back to the live tally
          </Link>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 p-3.5">
          {/* ── Hidden hole banner ────────────────────────────────── */}
          {hidden.includes(hole.number) && (
            <div className="flex items-start gap-2.5 rounded-xl border border-[#e8d48a] bg-gold-soft px-3 py-2.5 text-[13px] leading-snug text-[#5c4a0e]">
              <LockIcon size={18} className="mt-px flex-none" />
              <span>
                <b>Hidden hole.</b> Only your group can see this result until the Grand Reveal.
              </span>
            </div>
          )}

          {/* ── Publish notification ──────────────────────────────── */}
          {pubNotice !== null && (
            <div
              role="alert"
              className="fixed bottom-24 left-3.5 right-3.5 z-20 flex items-center justify-between gap-3 rounded-xl bg-[#e3f4ea] px-4 py-3 text-sm font-semibold text-[#17643a] shadow-lg"
            >
              <span>
                <CheckIcon size={16} className="inline-block" />{" "}
                Scores published for hole {pubNotice}
                {" — proceeding to next hole…"}
              </span>
              <button
                type="button"
                onClick={cancelPub}
                className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-bold text-navy active:opacity-80"
              >
                Cancel
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-[#fcebee] px-3 py-2 text-sm text-[#8e0b20]">
              {error}
            </p>
          )}

          {/* ── Each match section ────────────────────────────────── */}
          {matches.map((m) => {
            const t = tallies[m.id];
            const sideA = {
              gross: m.sideA.map((e) => getStrokes(m.id, e.id, hole.number)),
              received: m.sideA.map((e) => e.received[hole.number] ?? 0),
            };
            const sideB = {
              gross: m.sideB.map((e) => getStrokes(m.id, e.id, hole.number)),
              received: m.sideB.map((e) => e.received[hole.number] ?? 0),
            };
            const r = holeWinner(sideA, sideB);
            const na = bestNet(sideA);
            const nb = bestNet(sideB);
            const after = {
              a: t.a + (r === "A" ? 1 : r === "H" ? 0.5 : 0),
              b: t.b + (r === "B" ? 1 : r === "H" ? 0.5 : 0),
            };
            const multi = m.sideA.length > 1;
            const counted = (side: CardEntity[], best: number | null) =>
              (e: CardEntity) =>
                multi &&
                (dirtyHoles.has(hole.number) || holeDone(scores, hole.number)) &&
                best !== null &&
                best !== Infinity &&
                getStrokes(m.id, e.id, hole.number) !== 0 &&
                getStrokes(m.id, e.id, hole.number) - (e.received[hole.number] ?? 0) === best;
            return (
              <section key={m.id} className="flex flex-col gap-2">
                {/* Match header */}
                <div className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 text-[13px]">
                  <span className="text-muted">
                    {matches.length > 1 ? `Match ${m.matchNo} · ` : ""}
                    {t.thru ? `Thru ${t.thru}` : "Before this hole"}
                  </span>
                  <span className="font-bold">
                    <span style={{ color: teams[0].color }}>
                      {teams[0].name} {fmtPts(t.a)}
                    </span>
                    –{" "}
                    <span style={{ color: teams[1].color }}>
                      {fmtPts(t.b)} {teams[1].name}
                    </span>
                  </span>
                </div>

                {/* Player rows */}
                {[
                  ...m.sideA.map((e) => ({ e, team: teams[0], isBest: counted(m.sideA, na)(e) })),
                  ...m.sideB.map((e) => ({ e, team: teams[1], isBest: counted(m.sideB, nb)(e) })),
                ].map(({ e, team, isBest }) => {
                  const g = getStrokes(m.id, e.id, hole.number);
                  const rec = e.received[hole.number] ?? 0;
                  const capturedThis = isCaptured(m.id, e.id, hole.number);
                  const tee =
                    e.teeOrder.length === 2 ? e.teeOrder[holes.indexOf(hole) % 2] : null;
                  const deco = capturedThis ? decorationStyle(g, hole.par) : null;
                  return (
                    <div
                      key={e.id}
                      className={`flex items-center gap-3 rounded-2xl bg-white py-2.5 pr-2.5 pl-2 ${
                        isBest ? "shadow-[inset_0_0_0_2px_#c9a227]" : ""
                      } ${big ? "py-4" : ""}`}
                    >
                      <span className="w-1.5 self-stretch rounded" style={{ background: team.color }} />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        {big && (
                          <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: team.color }}>
                            {team.name} · one ball
                          </span>
                        )}
                        <span className={`${big ? "text-base" : "text-[15px]"} leading-tight font-bold`}>
                          {e.label}
                        </span>
                        <span className="text-xs text-muted">
                          {tee ? `${tee} tees off · ` : ""}
                          {rec ? `gets ${rec} stroke${rec > 1 ? "s" : ""}` : "no stroke"}
                        </span>
                        <span className="flex items-center gap-2">
                          {isBest && <span className="text-[11px] font-bold text-gold-ink">BEST BALL</span>}
                          <button
                            type="button"
                            onClick={() => pickUp(m.id, e.id)}
                            className="-my-2 py-2 text-[11px] font-semibold text-muted underline"
                          >
                            {g === 0 ? "Undo pick-up" : "Pick up"}
                          </button>
                        </span>
                      </div>

                      {/* Score display with decoration */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => bump(m.id, e.id, -1)}
                          aria-label={`One stroke less for ${e.label}`}
                          className={`${big ? "h-14 w-14" : "h-11 w-11"} rounded-xl border border-[#d8dce3] bg-white text-2xl text-navy active:bg-sand`}
                        >
                          −
                        </button>

                        <div className="flex flex-col items-center">
                          <span
                            className={`font-display ${big ? "text-5xl" : "text-[34px]"} leading-none font-bold ${
                              capturedThis || holeDone(scores, hole.number) ? "" : "cursor-pointer"
                            }`}
                            style={{
                              color: capturedThis || holeDone(scores, hole.number) ? "#000" : "#9ca3af",
                              ...(deco ?? {}),
                            }}
                            onClick={() => acceptPar(m.id, e.id)}
                          >
                            {g === 0 ? "X" : g}
                          </span>
                          <span className="text-[10px] text-muted">
                            {g === 0 ? "pick-up" : `net ${g - rec}`}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => bump(m.id, e.id, 1)}
                          aria-label={`One stroke more for ${e.label}`}
                          className={`${big ? "h-14 w-14" : "h-11 w-11"} rounded-xl bg-navy text-2xl text-white active:opacity-80`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Hole result bar — only once all players are captured */}
                {allOnHoleCaptured(hole.number) && (
                  <div
                    className="rounded-xl px-3.5 py-3 text-center text-sm font-bold text-white"
                    style={{
                      background: r === "A" ? teams[0].color : r === "B" ? teams[1].color : "#5b6472",
                    }}
                  >
                    {r === "A"
                      ? `${teams[0].name} win the hole`
                      : r === "B"
                        ? `${teams[1].name} win the hole`
                        : "Hole halved"}{" "}
                    ({show(r === "B" ? nb : na)} v {show(r === "B" ? na : nb)}) →{" "}
                    {fmtPts(after.a)} – {fmtPts(after.b)}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ── Bottom navigation: ← Back | Save | Forward → ────────────── */}
      {!done && (
        <div className="sticky bottom-0 grid grid-cols-[1fr_1.3fr_1fr] gap-2.5 bg-sand px-3.5 pt-2.5 pb-[max(18px,env(safe-area-inset-bottom))]">
          {/* Back */}
          <button
            type="button"
            onClick={() => setIdx(Math.max(0, idx - 1))}
            disabled={idx === 0}
            aria-label="Previous hole"
            className="h-14 rounded-2xl border border-[#d8dce3] bg-white text-sm font-bold text-navy disabled:opacity-40 active:opacity-90"
          >
            ← Previous
          </button>

          {/* Save — enabled only when all scores on this hole are captured */}
          <button
            type="button"
            onClick={save}
            disabled={
              // If hole is saved on server AND no local changes → disabled
              (holeDone(scores, hole.number) && !dirtyHoles.has(hole.number)) ||
                // Or not all captured yet
                !allOnHoleCaptured(hole.number)
            }
            className="h-14 rounded-2xl bg-gold text-sm font-bold text-navy disabled:opacity-40 active:opacity-90"
          >
            {holeDone(scores, hole.number) && !dirtyHoles.has(hole.number)
              ? "Saved"
              : `Save hole ${hole.number}`}
          </button>

          {/* Forward — enabled only after current hole is saved to server */}
          <button
            type="button"
            onClick={() => setIdx(Math.min(idx + 1, holes.length - 1))}
            disabled={!holeDone(scores, hole.number) || idx >= holes.length - 1}
            aria-label="Next hole"
            className="h-14 rounded-2xl bg-navy text-sm font-bold text-white disabled:opacity-40 active:opacity-90"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}