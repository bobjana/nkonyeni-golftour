import { BottomNav } from "@/components/BottomNav";
import { requireViewer } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return (
    <>
      <main className="flex flex-1 flex-col">{children}</main>
      <BottomNav organizer={!!viewer.is_organizer} />
    </>
  );
}
