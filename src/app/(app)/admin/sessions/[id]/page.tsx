import Link from "next/link";
import { notFound } from "next/navigation";
import { LockIcon } from "@/components/icons";
import { Button, Card, Field, Flash, inputCls, Pill } from "@/components/ui";
import { currentTour } from "@/lib/current";
import type { PairingRow } from "@/lib/db/types";
import { ALLOWANCE, courseHandicap, FORMAT_LABEL, matchStrokes } from "@/lib/scoring";
import { sessionTitle } from "@/lib/view";
import { deleteSession, publishDraw, resetDraw, setSessionStatus, updateScorers, updateSession } from "../../actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  matchups: "Each pairing must appear in exactly one match.",
  "no-pairings": "Both teams need pairings before the draw can be published.",
  "has-scores": "Scores have been entered, so the draw can't be reset.",
  "has-draw": "Reset the draw before deleting this session.",
};

export default async function AdminSessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const tour = await currentTour();
  const s = tour.sessions.find((x) => x.session.id === id);
  if (!s) notFound();
  const [ta, tb] = tour.teams;
  const day = tour.days.find((d) => d.day.id === s.day.id)!;
  const published = s.matches.length > 0;
  const pa = s.pairings.filter((p) => p.team_id === ta.id);
  const pb = s.pairings.filter((p) => p.team_id === tb.id);
  const name = (p: PairingRow) => [p.player1_id, p.player2_id].filter(Boolean).map((x) => tour.playerById.get(x!)!.name.split(" ")[0]).join(" & ");
  const playersIn = (p: PairingRow) => [p.player1_id, p.player2_id].filter(Boolean).map((x) => tour.playerById.get(x!)!);
  const singles = s.session.format === "singles";
  const ch = (pid: string) => {
    const p = tour.playerById.get(pid)!;
    const tee = day.course.tees.find((t) => t.id === p.tee_id) ?? day.course.defaultTee;
    return tee ? courseHandicap(p.handicap_index, tee, day.course.par) : Math.round(p.handicap_index);
  };
  const strokeNote = (a: PairingRow, b: PairingRow) => {
    const hc = (p: PairingRow) => [p.player1_id, p.player2_id].filter(Boolean).map((x) => ch(x!));
    const ents = s.session.format === "foursomes" ? [hc(a), hc(b)] : [...hc(a).map((x) => [x]), ...hc(b).map((x) => [x])];
    const st = matchStrokes(s.session.format, ents, s.played.length);
    return st.every((x) => x === 0) ? "Level" : `Strokes ${st.join(" · ")}`;
  };
  const groups = [...new Set(s.matches.map((m) => m.match.group_no))];

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{sessionTitle(s)}</h1>
        <Link href="/admin" className="text-sm font-semibold text-[#1d5bbf]">All sessions</Link>
      </div>
      {sp.saved && <Flash>{sp.saved === "published" ? "Draw published. Scorers will land on their scorecard." : "Saved."}</Flash>}
      {sp.error && <Flash tone="red">{ERRORS[sp.error] ?? "Something went wrong."}</Flash>}

      <Card>
        <form action={updateSession.bind(null, s.session.id)} className="grid grid-cols-2 gap-2.5">
          <Field label="Format">
            <select name="format" defaultValue={s.session.format} disabled={published} className={inputCls}>
              {Object.entries(FORMAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Slot">
            <select name="slot" defaultValue={s.session.slot} disabled={published} className={inputCls}>
              <option value="AM">Morning</option>
              <option value="PM">Afternoon</option>
            </select>
          </Field>
          <Field label="Holes">
            <select name="holes" defaultValue={s.session.holes} disabled={published} className={inputCls}>
              <option value="18">18</option>
              <option value="9">9</option>
            </select>
          </Field>
          <Field label="Which nine">
            <select name="nine" defaultValue={s.session.nine} disabled={published} className={inputCls}>
              <option value="front">Front</option>
              <option value="back">Back</option>
            </select>
          </Field>
          <Field label="Tee-off">
            <input name="tee_time" type="time" defaultValue={s.session.tee_time} className={inputCls} />
          </Field>
          <Field label="Pairings due">
            <input name="pairing_deadline" type="time" defaultValue={s.session.pairing_deadline ?? ""} className={inputCls} />
          </Field>
          <p className="col-span-2 flex items-center gap-2 rounded-[10px] bg-gold-soft px-2.5 py-2 text-[13px] text-[#5c4a0e]">
            <LockIcon size={16} />
            {s.hidden.length ? `Holes ${s.hidden.join(", ")} hidden` : "No hidden holes"} · allowance {Math.round(ALLOWANCE[s.session.format] * 100)}%
            {s.session.format === "foursomes" ? " combined" : ""}
          </p>
          <Button variant="ghost" type="submit" className="col-span-2">Save settings</Button>
        </form>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Draw</h2>
        {s.session.status === "draft" && <Pill tone="grey">Draft</Pill>}
        {s.session.status === "pairing" && <Pill tone="gold">Waiting for captains</Pill>}
        {s.session.status === "live" && <Pill tone="red">Live</Pill>}
        {s.session.status === "complete" && <Pill tone="green">Complete</Pill>}
      </div>

      {!published && (
        <>
          {s.session.status === "draft" && (
            <form action={setSessionStatus.bind(null, s.session.id, "pairing")}>
              <Button type="submit" variant="navy" className="w-full">Open pairings to captains</Button>
            </form>
          )}
          {[{ team: ta, list: pa }, { team: tb, list: pb }].map(({ team, list }) => (
            <Card key={team.id}>
              <div className="flex items-center justify-between">
                <span className="font-bold" style={{ color: team.color }}>{team.name}</span>
                <Link href={`/captain/${s.session.id}?team=${team.id}`} className="text-sm font-semibold text-[#1d5bbf]">
                  {list.length ? "Edit" : "Set pairings"}
                </Link>
              </div>
              {list.length ? (
                <ol className="flex flex-col gap-1 text-sm">
                  {list.map((p) => <li key={p.id}>{singles ? "Match" : "Pair"} {p.slot}: {name(p)}</li>)}
                </ol>
              ) : (
                <p className="text-sm text-muted">Not submitted yet{tour.playerById.get(team.captain_id ?? "") ? ` (captain: ${tour.playerById.get(team.captain_id!)!.name})` : ""}.</p>
              )}
            </Card>
          ))}

          {pa.length > 0 && pb.length === pa.length && (
            <Card>
              <h3 className="text-sm font-bold">Match-ups &amp; scorers</h3>
              <form action={publishDraw.bind(null, s.session.id)} className="flex flex-col gap-3">
                {pa.map((a, i) => {
                  const group = singles ? Math.ceil((i + 1) / 2) : i + 1;
                  const showScorer = !singles || i % 2 === 0;
                  const groupPairs = singles ? [pa[i], pa[i + 1], pb[i], pb[i + 1]].filter(Boolean) : [a, pb[i]];
                  return (
                    <div key={a.id} className="flex flex-col gap-2 border-t border-[#f0ede6] pt-3 first:border-0 first:pt-0">
                      <div className="flex justify-between text-xs font-bold text-muted">
                        <span>Match {i + 1} · Group {group}</span>
                        <span>{strokeNote(a, pb[i])} (default pairing)</span>
                      </div>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <select name={`m${i + 1}a`} defaultValue={a.id} className={inputCls} style={{ color: ta.color, fontWeight: 700 }}>
                          {pa.map((p) => <option key={p.id} value={p.id}>{name(p)}</option>)}
                        </select>
                        <span className="font-display font-bold text-gold-ink">VS</span>
                        <select name={`m${i + 1}b`} defaultValue={pb[i].id} className={inputCls} style={{ color: tb.color, fontWeight: 700 }}>
                          {pb.map((p) => <option key={p.id} value={p.id}>{name(p)}</option>)}
                        </select>
                      </div>
                      {showScorer && (
                        <Field label={`Scorer for group ${group}`}>
                          <select name={`g${group}scorer`} className={inputCls} defaultValue={playersIn(a)[0]?.id}>
                            {groupPairs.flatMap(playersIn).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            {tour.players.filter((p) => !groupPairs.flatMap(playersIn).some((g) => g.id === p.id)).map((p) => (
                              <option key={p.id} value={p.id}>{p.name} (not in group)</option>
                            ))}
                          </select>
                        </Field>
                      )}
                    </div>
                  );
                })}
                <p className="text-xs text-muted">If you change a match-up, check the scorer is still in that group.</p>
                <Button type="submit" variant="gold">Publish draw &amp; go live</Button>
              </form>
            </Card>
          )}
          <form action={deleteSession.bind(null, s.session.id)}>
            <Button type="submit" variant="danger" className="w-full">Delete session</Button>
          </form>
        </>
      )}

      {published && (
        <>
          <Card>
            <form action={updateScorers.bind(null, s.session.id)} className="flex flex-col gap-3">
              {groups.map((g) => {
                const ms = s.matches.filter((m) => m.match.group_no === g);
                return (
                  <div key={g} className="flex flex-col gap-2 border-t border-[#f0ede6] pt-3 first:border-0 first:pt-0">
                    {ms.map((m) => (
                      <div key={m.match.id} className="flex items-center justify-between gap-2 text-sm">
                        <span>
                          <b style={{ color: ta.color }}>{name(m.pairingA)}</b> v <b style={{ color: tb.color }}>{name(m.pairingB)}</b>
                        </span>
                        <span className="text-xs text-muted">{m.completed}/{m.holes.length}</span>
                      </div>
                    ))}
                    <div className="flex items-end gap-2">
                      <Field label={`Group ${g} scorer`} className="flex-1">
                        <select name={`g${g}scorer`} defaultValue={ms[0].match.scorer_id ?? ""} className={inputCls}>
                          {tour.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </Field>
                      <Link href={`/score/${s.session.id}?group=${g}`} className="flex h-11 items-center rounded-[10px] border border-[#d8dce3] px-3 text-sm font-semibold">
                        Open card
                      </Link>
                    </div>
                  </div>
                );
              })}
              <Button type="submit" variant="ghost">Save scorers</Button>
            </form>
          </Card>
          <div className="grid grid-cols-2 gap-2.5">
            {s.session.status === "live" ? (
              <form action={setSessionStatus.bind(null, s.session.id, "complete")}>
                <Button type="submit" className="w-full">Mark complete</Button>
              </form>
            ) : (
              <form action={setSessionStatus.bind(null, s.session.id, "live")}>
                <Button type="submit" variant="ghost" className="w-full">Reopen scoring</Button>
              </form>
            )}
            <form action={resetDraw.bind(null, s.session.id)}>
              <Button type="submit" variant="danger" className="w-full">Reset draw</Button>
            </form>
          </div>
        </>
      )}
    </>
  );
}
