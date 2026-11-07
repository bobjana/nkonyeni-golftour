import { requireOrganizer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { demoEnabled } from "@/lib/demo";
import { AdminTabs } from "./AdminTabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const org = await requireOrganizer();
  const db = await getDb();
  const event = await db.selectFrom("events").select("name").where("id", "=", org.event_id).executeTakeFirstOrThrow();
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-col gap-3 bg-navy px-4 py-3.5 text-white">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-wider text-gold">ORGANIZER</span>
          <span className="text-xs text-mist">{event.name}</span>
        </div>
        <AdminTabs demo={demoEnabled()} />
      </header>
      <div className="flex flex-col gap-3 p-3.5">{children}</div>
    </div>
  );
}
