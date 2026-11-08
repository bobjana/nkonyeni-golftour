import { describe, expect, it } from "vitest";
import { buildPlan, demoGross, mulberry32, type PlanInput } from "./demo-plan";

const front = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const all = [...front, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const team = (id: string) => ({ id, name: id, players: [1, 2, 3, 4].map((n) => ({ id: `${id}${n}`, name: `${id} ${n}` })) });

// The sample tour: 5 sessions over 3 days.
const input: PlanInput = {
  seed: 42,
  teams: [team("med"), team("biz")],
  days: [
    { id: "d1", number: 1, sessions: [{ id: "s1", slot: "PM", format: "better_ball", played: all, hidden: [16, 17, 18] }] },
    { id: "d2", number: 2, sessions: [
      { id: "s2", slot: "AM", format: "better_ball", played: all, hidden: [16, 17, 18] },
      { id: "s3", slot: "PM", format: "foursomes", played: front, hidden: [7, 8, 9] },
    ] },
    { id: "d3", number: 3, sessions: [
      { id: "s4", slot: "AM", format: "singles", played: all, hidden: [16, 17, 18] },
      { id: "s5", slot: "PM", format: "foursomes", played: front.map((h) => h + 9), hidden: [16, 17, 18] },
    ] },
  ],
};

describe("demo plan", () => {
  const plan = buildPlan(input);
  const a = plan.actions;

  it("runs in time order and ends with the final result", () => {
    expect(a.every((x, i) => i === 0 || x.t >= a[i - 1].t)).toBe(true);
    expect(a.at(-1)!.kind).toBe("end");
  });

  it("walks every session through pairings, draw, every hole and completion", () => {
    for (const day of input.days)
      for (const s of day.sessions) {
        const mine = a.filter((x) => "session" in x && x.session === s.id);
        expect(mine.map((x) => x.kind).filter((k) => k !== "hole")).toEqual(["open", "submit", "submit", "publish", "complete"]);
        const groups = 2; // 4 a side: two pairs, or four singles played two to a group
        expect(mine.filter((x) => x.kind === "hole")).toHaveLength(groups * s.played.length);
        const publish = mine.find((x) => x.kind === "publish")!;
        const holes = mine.filter((x) => x.kind === "hole");
        expect(holes.every((h) => h.t > publish.t)).toBe(true);
        expect(mine.at(-1)!.kind).toBe("complete");
      }
  });

  it("reveals each day after its last session", () => {
    const reveals = a.filter((x) => x.kind === "reveal");
    expect(reveals.map((x) => x.kind === "reveal" && x.day)).toEqual(["d1", "d2", "d3"]);
    const lastComplete = a.findLastIndex((x) => x.kind === "complete" && x.session === "s3");
    expect(a.findIndex((x) => x.kind === "reveal" && x.day === "d2")).toBeGreaterThan(lastComplete);
  });

  it("pairs every player once per session and picks a scorer from the group", () => {
    const submits = a.filter((x) => x.kind === "submit" && x.session === "s4");
    for (const s of submits) if (s.kind === "submit") expect(s.slots.flat().sort()).toHaveLength(4);
    const pub = a.find((x) => x.kind === "publish" && x.session === "s1");
    expect(pub?.kind === "publish" && pub.scorers).toHaveLength(2);
  });

  it("plants one disputed hole on each day", () => {
    const disputes = a.filter((x) => x.kind === "hole" && x.dispute);
    expect(disputes.map((x) => x.kind === "hole" && x.session)).toEqual(["s1", "s2", "s4"]);
  });

  it("takes about half an hour at 1×", () => {
    expect(a.at(-1)!.t / 60).toBeGreaterThan(20);
    expect(a.at(-1)!.t / 60).toBeLessThan(35);
  });

  it("makes plausible scores", () => {
    const rand = mulberry32(1);
    const xs = Array.from({ length: 2000 }, () => demoGross(rand, 4, 1, false));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...xs)).toBeLessThanOrEqual(8);
    const avg = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(avg).toBeGreaterThan(5);
    expect(avg).toBeLessThan(6);
  });
});
