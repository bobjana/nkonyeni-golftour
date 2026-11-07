"use client";

import Link from "next/link";
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

export function ScoreCard({
  sessionId,
  title,
  format,
  teeName,
  holes,
  hidden,
  teams,
  matches,
}: {
  sessionId: string;
  title: string;
  format: Format;
  teeName: string;
  holes: HoleInfo[];
  hidden: number[];
  teams: { name: string; color: string }[];
  matches: CardMatch[];
}) {
  const qk = queueKey(sessionId);
  const [scores, setScores] = useState<Scores>(() => Object.fromEntries(matches.map((m) => [m.id, structuredClone(m.scores)])));
  const entitiesOf = (m: CardMatch) => [...m.sideA, ...m.sideB];
  const holeDone = useCallback(
    (s: Scores, hole: number) => matches.every((m) => entitiesOf(m).every((e) => s[m.id]?.[e.id]?.[hole] !== undefined)),
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
      } else {
        setError((await res.json().catch(() => ({})))?.error ?? `Sync failed (${res.status})`);
      }
    } catch {
      // offline or flaky signal: keep the queue and retry
    } finally {
      setSyncing(false);
    }
  }, [qk]);

  // Re-apply anything still queued on this phone (newer than what the server sent), then keep syncing.
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
    const t = setInterval(flush, 10000);
    flush();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flush, qk]);

  // Pick up holes entered elsewhere (another phone, or the demo) when the page refreshes.
  useEffect(() => {
    setScores((prev) => {
      let changed = false;
      const next = structuredClone(prev);
      for (const m of matches)
        for (const [entityId, byHole] of Object.entries(m.scores))
          for (const [h, strokes] of Object.entries(byHole)) {
            const row = ((next[m.id] ??= {})[entityId] ??= {});
            if (row[Number(h)] === undefined) {
              row[Number(h)] = strokes;
              changed = true;
            }
          }
      if (!changed) return prev;
      setIdx((i) => (i < holes.length && holeDone(next, holes[i].number) ? firstOpen(next) : i));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  const done = idx >= holes.length;
  const hole = holes[Math.min(idx, holes.length - 1)];

  // Draft strokes for the hole on screen: what's saved, else par.
  const initialDraft = useCallback(
    (h: HoleInfo, s: Scores) =>
      Object.fromEntries(matches.map((m) => [m.id, Object.fromEntries(entitiesOf(m).map((e) => [e.id, s[m.id]?.[e.id]?.[h.number] ?? h.par]))])),
    [matches],
  );
  const [draft, setDraft] = useState<Record<string, Record<string, number>>>(() => initialDraft(hole, scores));
  useEffect(() => {
    setDraft(initialDraft(hole, scores));
    // only when the hole changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hole.number]);

  const resultFor = (m: CardMatch, h: number, s: Scores): HoleWinner | null =>
    holeWinner(
      { gross: m.sideA.map((e) => s[m.id]?.[e.id]?.[h]), received: m.sideA.map((e) => e.received[h] ?? 0) },
      { gross: m.sideB.map((e) => s[m.id]?.[e.id]?.[h]), received: m.sideB.map((e) => e.received[h] ?? 0) },
    );

  const tallies = useMemo(
    () =>
      Object.fromEntries(
        matches.map((m) => {
          const before = holes.slice(0, Math.min(idx, holes.length)).map((h) => resultFor(m, h.number, scores));
          return [m.id, { ...pointsFor(before), thru: before.filter(Boolean).length }];
        }),
      ),
     
    [matches, holes, idx, scores],
  );

  const bump = (matchId: string, entityId: string, d: number) =>
    setDraft((p) => {
      const cur = p[matchId][entityId];
      const next = cur === 0 ? (d > 0 ? hole.par : hole.par - 1) : Math.max(1, Math.min(15, cur + d));
      return { ...p, [matchId]: { ...p[matchId], [entityId]: next } };
    });
  const pickUp = (matchId: string, entityId: string) =>
    setDraft((p) => ({ ...p, [matchId]: { ...p[matchId], [entityId]: p[matchId][entityId] === 0 ? hole.par : 0 } }));

  const save = () => {
    const at = new Date().toISOString();
    const entries: Entry[] = matches.flatMap((m) => entitiesOf(m).map((e) => ({ matchId: m.id, entityId: e.id, hole: hole.number, strokes: draft[m.id][e.id], at })));
    const next = structuredClone(scores);
    for (const e of entries) ((next[e.matchId] ??= {})[e.entityId] ??= {})[e.hole] = e.strokes;
    setScores(next);
    writeQueue(qk, [...readQueue(qk), ...entries]);
    setPending(readQueue(qk).length);
    flush();
    const after = holes.findIndex((h, i) => i > idx && !holeDone(next, h.number));
    setIdx(after === -1 ? (holes.every((h) => holeDone(next, h.number)) ? holes.length : idx + 1) : after);
  };

  const isHidden = hidden.includes(hole.number);
  const status = !online ? (
    <span className="flex items-center gap-1 text-[11px] text-[#ffd27a]"><OfflineIcon size={14} />Offline{pending ? ` · ${pending} saved on phone` : ""}</span>
  ) : pending || syncing ? (
    <span className="text-[11px] text-[#ffd27a]">Syncing {pending}…</span>
  ) : (
    <span className="flex items-center gap-1 text-[11px] text-[#9ee6bd]"><CheckIcon size={14} />Synced</span>
  );
  const big = format === "foursomes";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-3 bg-navy px-4 pt-3 pb-3.5 text-white">
        <div className="flex items-center justify-between gap-2">
          <Link href="/live" className="flex items-center gap-1 text-[13px] font-semibold">
            <BackIcon size={16} />
            Live tally
          </Link>
          <span className="truncate text-xs text-mist">{title}</span>
          {status}
        </div>
        {!done && (
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold tracking-wider text-gold">HOLE</span>
              <span className="font-display text-6xl leading-[0.9] font-bold">{hole.number}</span>
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
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${holes.length}, minmax(0, 1fr))` }}>
          {holes.map((h, i) => {
            const r = matches.length === 1 ? resultFor(matches[0], h.number, scores) : null;
            const complete = holeDone(scores, h.number);
            const current = i === idx;
            const bg = current ? "#c9a227" : r === "A" ? teams[0].color : r === "B" ? teams[1].color : r === "H" || complete ? "#8a93a1" : "rgba(255,255,255,0.12)";
            return (
              <button
                key={h.number}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`Go to hole ${h.number}`}
                className={`flex h-6 items-center justify-center rounded text-[10px] font-bold ${hidden.includes(h.number) && !current ? "outline outline-1 outline-dashed outline-gold" : ""}`}
                style={{ background: bg, color: current ? "#0b1f3a" : complete ? "#fff" : "#c7d0dd" }}
              >
                {h.number}
              </button>
            );
          })}
        </div>
      </header>

      {done ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <CheckIcon size={48} className="text-[#17643a]" />
          <h1 className="text-xl font-bold">Card complete</h1>
          <p className="text-sm text-muted">{pending ? `${pending} scores still syncing. Keep the app open until you have signal.` : "All scores are in. Thanks for keeping score!"}</p>
          {matches.map((m) => {
            const all = pointsFor(holes.map((h) => resultFor(m, h.number, scores)));
            return (
              <p key={m.id} className="font-display text-2xl font-bold">
                Match {m.matchNo}: <span style={{ color: teams[0].color }}>{fmtPts(all.a)}</span> – <span style={{ color: teams[1].color }}>{fmtPts(all.b)}</span>
              </p>
            );
          })}
          <button type="button" onClick={() => setIdx(holes.length - 1)} className="text-sm font-semibold text-[#1d5bbf] underline">Edit last hole</button>
          <Link href="/live" className="w-full rounded-2xl bg-navy py-4 font-bold text-white">Back to the live tally</Link>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 p-3.5">
          {isHidden && (
            <div className="flex items-start gap-2.5 rounded-xl border border-[#e8d48a] bg-gold-soft px-3 py-2.5 text-[13px] leading-snug text-[#5c4a0e]">
              <LockIcon size={18} className="mt-px flex-none" />
              <span><b>Hidden hole.</b> Only your group can see this result until the Grand Reveal.</span>
            </div>
          )}
          {error && <p role="alert" className="rounded-lg bg-[#fcebee] px-3 py-2 text-sm text-[#8e0b20]">{error}</p>}

          {matches.map((m) => {
            const t = tallies[m.id];
            const d = draft[m.id] ?? {};
            const sideA = { gross: m.sideA.map((e) => d[e.id]), received: m.sideA.map((e) => e.received[hole.number] ?? 0) };
            const sideB = { gross: m.sideB.map((e) => d[e.id]), received: m.sideB.map((e) => e.received[hole.number] ?? 0) };
            const r = holeWinner(sideA, sideB);
            const na = bestNet(sideA);
            const nb = bestNet(sideB);
            const show = (n: number | null) => (n === null || n === Infinity ? "X" : n);
            const after = { a: t.a + (r === "A" ? 1 : r === "H" ? 0.5 : 0), b: t.b + (r === "B" ? 1 : r === "H" ? 0.5 : 0) };
            const multi = m.sideA.length > 1;
            const counted = (side: CardEntity[], best: number | null) =>
              (e: CardEntity) => multi && best !== null && best !== Infinity && d[e.id] !== 0 && d[e.id] - (e.received[hole.number] ?? 0) === best;
            return (
              <section key={m.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 text-[13px]">
                  <span className="text-muted">{matches.length > 1 ? `Match ${m.matchNo} · ` : ""}{t.thru ? `Thru ${t.thru}` : "Before this hole"}</span>
                  <span className="font-bold">
                    <span style={{ color: teams[0].color }}>{teams[0].name} {fmtPts(t.a)}</span> – <span style={{ color: teams[1].color }}>{fmtPts(t.b)} {teams[1].name}</span>
                  </span>
                </div>
                {[...m.sideA.map((e) => ({ e, team: teams[0], isBest: counted(m.sideA, na)(e) })), ...m.sideB.map((e) => ({ e, team: teams[1], isBest: counted(m.sideB, nb)(e) }))].map(({ e, team, isBest }) => {
                  const g = d[e.id] ?? hole.par;
                  const rec = e.received[hole.number] ?? 0;
                  const tee = e.teeOrder.length === 2 ? e.teeOrder[holes.indexOf(hole) % 2] : null;
                  return (
                    <div key={e.id} className={`flex items-center gap-3 rounded-2xl bg-white py-2.5 pr-2.5 pl-2 ${isBest ? "shadow-[inset_0_0_0_2px_#c9a227]" : ""} ${big ? "py-4" : ""}`}>
                      <span className="w-1.5 self-stretch rounded" style={{ background: team.color }} />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        {big && <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: team.color }}>{team.name} · one ball</span>}
                        <span className={`${big ? "text-base" : "text-[15px]"} leading-tight font-bold`}>{e.label}</span>
                        <span className="text-xs text-muted">
                          {tee ? `${tee} tees off · ` : ""}
                          {rec ? `gets ${rec} stroke${rec > 1 ? "s" : ""}` : "no stroke"}
                        </span>
                        <span className="flex items-center gap-2">
                          {isBest && <span className="text-[11px] font-bold text-gold-ink">BEST BALL</span>}
                          <button type="button" onClick={() => pickUp(m.id, e.id)} className="-my-2 py-2 text-[11px] font-semibold text-muted underline">
                            {g === 0 ? "Undo pick-up" : "Pick up"}
                          </button>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => bump(m.id, e.id, -1)} aria-label={`One stroke less for ${e.label}`} className={`${big ? "h-14 w-14" : "h-11 w-11"} rounded-xl border border-[#d8dce3] bg-white text-2xl text-navy active:bg-sand`}>−</button>
                        <div className="flex w-12 flex-col items-center">
                          <span className={`font-display ${big ? "text-5xl" : "text-[34px]"} leading-none font-bold`}>{g === 0 ? "X" : g}</span>
                          <span className="text-[10px] text-muted">{g === 0 ? "pick-up" : `net ${g - rec}`}</span>
                        </div>
                        <button type="button" onClick={() => bump(m.id, e.id, 1)} aria-label={`One stroke more for ${e.label}`} className={`${big ? "h-14 w-14" : "h-11 w-11"} rounded-xl bg-navy text-2xl text-white active:opacity-80`}>+</button>
                      </div>
                    </div>
                  );
                })}
                <div
                  className="rounded-xl px-3.5 py-3 text-center text-sm font-bold text-white"
                  style={{ background: r === "A" ? teams[0].color : r === "B" ? teams[1].color : "#5b6472" }}
                >
                  {r === "A" ? `${teams[0].name} win the hole` : r === "B" ? `${teams[1].name} win the hole` : "Hole halved"} ({show(r === "B" ? nb : na)} v {show(r === "B" ? na : nb)}) → {fmtPts(after.a)} – {fmtPts(after.b)}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!done && (
        <div className="sticky bottom-0 grid grid-cols-[64px_1fr] gap-2.5 bg-sand px-3.5 pt-2.5 pb-[max(18px,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} aria-label="Previous hole" className="flex h-14 items-center justify-center rounded-2xl border border-[#d8dce3] bg-white text-navy disabled:opacity-40">
            <BackIcon size={20} />
          </button>
          <button type="button" onClick={save} className="h-14 rounded-2xl bg-gold text-base font-bold text-navy active:opacity-90">
            Save hole {hole.number}{idx < holes.length - 1 ? " · Next" : " · Finish"}
          </button>
        </div>
      )}
    </div>
  );
}
