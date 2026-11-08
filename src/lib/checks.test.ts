import { describe, expect, it } from "vitest";
import { findConflicts } from "./checks";

const e = (actor: string, strokes: number, at: string, hole = 5) => ({ match_id: "m1", entity_id: "p1", hole, strokes, at, actor });

describe("score checks", () => {
  it("ignores one person correcting their own entry", () => {
    expect(findConflicts([e("sipho", 5, "10:00"), e("sipho", 6, "10:01")], [])).toEqual([]);
  });

  it("ignores two people agreeing", () => {
    expect(findConflicts([e("sipho", 5, "10:00"), e("thabo", 5, "10:02")], [])).toEqual([]);
  });

  it("flags two people disagreeing, with each person's latest entry", () => {
    const out = findConflicts([e("sipho", 4, "10:00"), e("thabo", 6, "10:02"), e("sipho", 5, "10:03")], []);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ matchId: "m1", entityId: "p1", hole: 5 });
    expect(out[0].entries.map((x) => [x.player, x.strokes])).toEqual([["thabo", 6], ["sipho", 5]]);
  });

  it("counts demo entries as the player they stand for", () => {
    expect(findConflicts([e("demo:sipho", 5, "10:00"), e("sipho", 6, "10:01")], [])).toEqual([]);
    expect(findConflicts([e("demo:sipho", 5, "10:00"), e("demo:thabo", 6, "10:00")], [])).toHaveLength(1);
  });

  it("is settled by a ruling until someone enters a different value after it", () => {
    const log = [e("sipho", 5, "10:00"), e("thabo", 6, "10:02"), e("ruling:org", 6, "18:00")];
    const ruling = [{ match_id: "m1", entity_id: "p1", hole: 5, strokes: 6, resolved_at: "18:00" }];
    expect(findConflicts(log, ruling)).toEqual([]);
    expect(findConflicts([...log, e("thabo", 6, "18:05")], ruling)).toEqual([]);
    expect(findConflicts([...log, e("sipho", 5, "18:05")], ruling)).toHaveLength(1);
  });
});
