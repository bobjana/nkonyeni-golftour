import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { demoStatus, tickDemo } from "@/lib/demo";

/** Called every few seconds by any open phone while a demo is on; applies due steps. */
export async function POST() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const applied = await tickDemo(viewer.event_id);
  const status = await demoStatus(viewer.event_id);
  return NextResponse.json({ applied, active: !!status && !status.finished });
}
