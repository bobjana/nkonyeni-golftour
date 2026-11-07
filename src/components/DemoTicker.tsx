"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * While a demo is on, every open phone nudges it forward every few seconds
 * and re-renders when something happened, so screens update almost live.
 */
export function DemoTicker({ running, organizer }: { running: boolean; organizer: boolean }) {
  const router = useRouter();
  useEffect(() => {
    let busy = false;
    const t = setInterval(async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const res = await fetch("/api/demo/tick", { method: "POST" });
        const body = res.ok ? ((await res.json()) as { applied: number; active: boolean }) : null;
        if (body && (body.applied > 0 || !body.active)) router.refresh();
      } catch {
        // offline: try again next round
      } finally {
        busy = false;
      }
    }, 3000);
    return () => clearInterval(t);
  }, [router]);

  const label = running ? "Demo running" : "Demo paused";
  const cls = "block w-full bg-gold py-1 text-center text-[11px] font-bold tracking-wide text-navy";
  return organizer ? (
    <Link href="/admin/demo" className={cls}>{label.toUpperCase()} · CONTROLS</Link>
  ) : (
    <span className={cls}>{label.toUpperCase()}</span>
  );
}
