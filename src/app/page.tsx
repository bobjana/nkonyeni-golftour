import { redirect } from "next/navigation";
import { currentTour } from "@/lib/current";
import { scorerMatches } from "@/lib/tour";

/** Scorers go straight to their card while their session is in play; everyone else to the tally. */
export default async function Home() {
  const tour = await currentTour();
  const live = tour.sessions.filter((s) => s.session.status === "live");
  for (const s of live) {
    const mine = scorerMatches(s, tour.viewer!.id);
    if (mine.some((m) => m.completed < m.holes.length)) redirect(`/score/${s.session.id}`);
  }
  redirect(live.length ? "/live" : "/standings");
}
