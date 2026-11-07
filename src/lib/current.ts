import "server-only";
import { cache } from "react";
import { requireViewer } from "./auth";
import { loadTour } from "./tour";

/** The signed-in player and their tour, loaded once per request. */
export const currentTour = cache(async () => {
  const viewer = await requireViewer();
  return loadTour(viewer.event_id, viewer);
});
