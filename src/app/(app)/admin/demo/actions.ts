"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { demoEnabled, pauseDemo, resumeDemo, setDemoSpeed, skipDemo, startDemo, stopDemo } from "@/lib/demo";

async function guard() {
  const org = await requireOrganizer();
  if (!demoEnabled()) redirect("/admin");
  return org.event_id;
}
const done = () => {
  revalidatePath("/", "layout");
  redirect("/admin/demo");
};

export async function start(form: FormData) {
  const eventId = await guard();
  if (!form.get("confirm")) redirect("/admin/demo?error=confirm");
  await startDemo(eventId, Number(form.get("speed")) || 1);
  done();
}

export async function pause() {
  await pauseDemo(await guard());
  done();
}

export async function resume() {
  await resumeDemo(await guard());
  done();
}

export async function speed(value: number) {
  await setDemoSpeed(await guard(), value);
  done();
}

export async function skip() {
  await skipDemo(await guard());
  done();
}

export async function stop() {
  await stopDemo(await guard());
  done();
}
