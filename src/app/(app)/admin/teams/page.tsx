import { Button, Card, Field, Flash, inputCls, Pill } from "@/components/ui";
import { currentTour } from "@/lib/current";
import type { PlayerRow, TeamRow } from "@/lib/db/types";
import { appUrl } from "@/lib/email";
import { removePlayer, savePlayer, updateTeam } from "../actions";
import { InviteLinkField } from "./InviteLinkField";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  missing: "Name and email are required.",
  email: "Another player already uses that email.",
  "in-use": "That player is in a draw (or is you), so they can't be removed.",
};

export default async function AdminTeamsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const tour = await currentTour();
  const base = await appUrl();
  const tees = tour.courses[0]?.tees ?? [];

  const PlayerForm = ({ team, p }: { team: TeamRow; p?: PlayerRow }) => (
    <form action={savePlayer.bind(null, team.id, p?.id ?? null)} className="grid grid-cols-2 gap-2.5">
      <Field label="Name" className="col-span-2">
        <input name="name" defaultValue={p?.name} required className={inputCls} />
      </Field>
      <Field label="Email" className="col-span-2">
        <input name="email" type="email" defaultValue={p?.email} required className={inputCls} />
      </Field>
      <Field label="Handicap index">
        <input name="handicap_index" inputMode="decimal" defaultValue={p?.handicap_index ?? ""} required className={inputCls} />
      </Field>
      <Field label="Tee">
        <select name="tee_id" defaultValue={p?.tee_id ?? ""} className={inputCls}>
          <option value="">Course default</option>
          {tees.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_organizer" defaultChecked={!!p?.is_organizer} className="h-5 w-5" />
        Organizer access
      </label>
      <Button type="submit" variant="navy" className="col-span-2">{p ? "Save player" : "Add player"}</Button>
    </form>
  );

  return (
    <>
      {sp.saved && <Flash>Saved.</Flash>}
      {sp.error && <Flash tone="red">{ERRORS[sp.error] ?? "Something went wrong."}</Flash>}

      {tour.teams.map((team) => {
        const roster = tour.players.filter((p) => p.team_id === team.id);
        return (
          <Card key={team.id} className="overflow-hidden !p-0">
            <div className="flex items-center justify-between px-3.5 py-3 text-white" style={{ background: team.color }}>
              <span className="text-base font-bold">{team.name}</span>
              <span className="text-xs font-semibold">{roster.length} players</span>
            </div>
            {roster.map((p) => (
              <details key={p.id} className="border-t border-[#f0ede6] px-3.5 py-2.5 first-of-type:border-0">
                <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto_auto] items-center gap-2.5">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">{p.name}</span>
                    <span className="text-xs text-muted">
                      {[team.captain_id === p.id && "Captain", p.is_organizer && "Organizer"].filter(Boolean).join(" · ") || "Player"}
                    </span>
                  </span>
                  <span className="text-right text-[13px] font-bold">HI {p.handicap_index.toFixed(1)}</span>
                  {p.joined_at ? <Pill tone="green">Joined</Pill> : <Pill tone="grey">Not joined</Pill>}
                </summary>
                <div className="flex flex-col gap-3 pt-3">
                  <PlayerForm team={team} p={p} />
                  <InviteLinkField url={`${base}/join/${p.invite_token}`} base={base} />
                  <div className="grid grid-cols-2 gap-2">
                    <form action={removePlayer.bind(null, p.id)}>
                      <Button type="submit" variant="danger" className="w-full">Remove player</Button>
                    </form>
                  </div>
                </div>
              </details>
            ))}
            <details className="border-t border-[#f0ede6] px-3.5 py-3">
              <summary className="cursor-pointer text-center text-sm font-bold text-[#1d5bbf]">+ Add player</summary>
              <div className="pt-3"><PlayerForm team={team} /></div>
            </details>
            <details className="border-t border-[#f0ede6] px-3.5 py-3">
              <summary className="cursor-pointer text-center text-sm font-semibold text-muted">Team settings</summary>
              <form action={updateTeam.bind(null, team.id)} className="grid grid-cols-[1fr_64px] gap-2.5 pt-3">
                <Field label="Team name">
                  <input name="name" defaultValue={team.name} required className={inputCls} />
                </Field>
                <Field label="Colour">
                  <input name="color" type="color" defaultValue={team.color} className="h-11 w-full rounded-[10px] border border-[#d8dce3]" />
                </Field>
                <Field label="Captain" className="col-span-2">
                  <select name="captain_id" defaultValue={team.captain_id ?? ""} className={inputCls}>
                    <option value="">No captain</option>
                    {roster.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Button type="submit" variant="ghost" className="col-span-2">Save team</Button>
              </form>
            </details>
          </Card>
        );
      })}
    </>
  );
}