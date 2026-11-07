import { BottomNav } from "@/components/BottomNav";
import { DemoTicker } from "@/components/DemoTicker";
import { requireViewer } from "@/lib/auth";
import { demoStatus } from "@/lib/demo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const demo = await demoStatus(viewer.event_id);
  return (
    <>
      {demo && !demo.finished && <DemoTicker running={demo.running} organizer={!!viewer.is_organizer} />}
      <main className="flex flex-1 flex-col">{children}</main>
      <BottomNav organizer={!!viewer.is_organizer} />
    </>
  );
}
