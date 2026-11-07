import Link from "next/link";
import { Splash } from "@/components/Splash";
import { getDb } from "@/lib/db";
import { LoginForm } from "../../login/LoginForm";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const player = await db.selectFrom("players").selectAll().where("invite_token", "=", token).executeTakeFirst();
  if (!player) {
    return (
      <Splash>
        <div className="rounded-2xl bg-white p-5 text-navy">
          <h1 className="text-lg font-bold">This invite link isn&apos;t valid</h1>
          <p className="mt-1 text-sm text-muted">Ask your organizer to send a new one, or sign in with your email.</p>
          <Link href="/login" className="mt-4 block rounded-xl bg-navy py-3 text-center font-semibold text-white">Sign in</Link>
        </div>
      </Splash>
    );
  }
  const teams = await db.selectFrom("teams").selectAll().where("event_id", "=", player.event_id).orderBy("sort").execute();
  const team = teams.find((t) => t.id === player.team_id);
  const days = await db.selectFrom("days").select("id").where("event_id", "=", player.event_id).execute();
  const sessions = days.length ? await db.selectFrom("sessions").select("id").where("day_id", "in", days.map((d) => d.id)).execute() : [];
  const course = await db.selectFrom("courses").select("name").where("event_id", "=", player.event_id).executeTakeFirst();
  return (
    <Splash subtitle={`${course?.name ?? ""} · ${days.length} days · ${sessions.length} sessions`} teams={teams}>
      <LoginForm token={token} email={player.email} name={player.name} team={team && { name: team.name, color: team.color }} />
      <p className="mt-auto text-center text-[13px] text-mist">
        Not {player.name.split(" ")[0]}? <Link href="/login" className="text-gold underline">Sign in with your own email</Link>
      </p>
    </Splash>
  );
}
