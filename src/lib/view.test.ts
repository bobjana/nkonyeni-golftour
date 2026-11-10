import { describe, expect, it } from "vitest";
import type { DayView, SessionView } from "./tour";
import { dayComplete, latestCompleteSession } from "./view";

const session = (status: "draft" | "pairing" | "live" | "complete") => ({ session: { status } } as unknown as SessionView);
const day = (...sessions: SessionView[]) => ({ sessions } as unknown as DayView);

describe("dayComplete", () => {
  it("is false until every session in the day has finished", () => {
    expect(dayComplete(day(session("complete"), session("draft")))).toBe(false);
    expect(dayComplete(day(session("complete"), session("live")))).toBe(false);
    expect(dayComplete(day(session("complete"), session("pairing")))).toBe(false);
  });

  it("is true when every session is complete", () => {
    expect(dayComplete(day(session("complete")))).toBe(true);
    expect(dayComplete(day(session("complete"), session("complete")))).toBe(true);
  });
});

describe("latestCompleteSession", () => {
  it("returns the latest finished session, AM before PM regardless of input order", () => {
    const am = session("complete");
    const pm = session("draft");
    expect(latestCompleteSession(day(am, pm))).toBe(am);
    expect(latestCompleteSession(day(pm, am))).toBe(am);
  });

  it("returns the PM session when both have finished", () => {
    const am = session("complete");
    const pm = session("complete");
    expect(latestCompleteSession(day(am, pm))).toBe(pm);
  });

  it("returns undefined when nothing has finished", () => {
    expect(latestCompleteSession(day(session("live"), session("draft")))).toBeUndefined();
  });
});
