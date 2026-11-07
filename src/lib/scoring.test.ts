import { describe, expect, it } from "vitest";
import {
  courseHandicap,
  fmtPts,
  hiddenHoleNumbers,
  holeWinner,
  matchStrokes,
  pointsFor,
  sessionHoleNumbers,
  strokesOnHole,
  type Hole,
} from "./scoring";

const PAR = [4, 4, 3, 4, 5, 3, 5, 4, 4, 4, 4, 5, 4, 3, 4, 4, 5, 3];
const SI = [18, 4, 8, 6, 10, 14, 2, 16, 12, 9, 1, 17, 7, 15, 5, 11, 3, 13];
const HOLES: Hole[] = PAR.map((par, i) => ({ number: i + 1, par, si: SI[i] }));
const BLUE = { rating: 69.5, slope: 131 };

describe("handicaps", () => {
  it("computes WHS course handicap off the Blue tee", () => {
    expect(courseHandicap(8.2, BLUE, 72)).toBe(7);
    expect(courseHandicap(14.6, BLUE, 72)).toBe(14);
    expect(courseHandicap(5.1, BLUE, 72)).toBe(3);
    expect(courseHandicap(18.0, BLUE, 72)).toBe(18);
  });

  it("better ball: 90% then strokes off the lowest", () => {
    expect(matchStrokes("better_ball", [[7], [14], [3], [18]], 18)).toEqual([3, 10, 0, 13]);
  });

  it("singles: 100% difference", () => {
    expect(matchStrokes("singles", [[7], [3]], 18)).toEqual([4, 0]);
  });

  it("foursomes: 50% of combined, halved on a nine", () => {
    // Thabo 10 + Lize 23 = 33 → 17 ; Pieter 8 + Nomsa 16 = 24 → 12 ; diff 5 → 3 over nine
    expect(matchStrokes("foursomes", [[10, 23], [8, 16]], 18)).toEqual([5, 0]);
    expect(matchStrokes("foursomes", [[10, 23], [8, 16]], 9)).toEqual([3, 0]);
  });
});

describe("stroke allocation", () => {
  it("18 holes: by stroke index", () => {
    const got = HOLES.filter((h) => strokesOnHole(3, h, HOLES) === 1).map((h) => h.number);
    expect(got.sort((a, b) => a - b)).toEqual([7, 11, 17]);
  });

  it("over 18 strokes gives a second stroke on the hardest holes", () => {
    expect(strokesOnHole(20, HOLES[10], HOLES)).toBe(2); // SI 1
    expect(strokesOnHole(20, HOLES[0], HOLES)).toBe(1); // SI 18
  });

  it("9 holes: ranks SI within the nine", () => {
    const front = HOLES.slice(0, 9);
    const got = front.filter((h) => strokesOnHole(3, h, front) === 1).map((h) => h.number);
    expect(got.sort((a, b) => a - b)).toEqual([2, 4, 7]);
  });
});

describe("holes in play", () => {
  it("front, back and full", () => {
    expect(sessionHoleNumbers(9, "back")).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(sessionHoleNumbers(18, "back")).toHaveLength(18);
    expect(hiddenHoleNumbers(sessionHoleNumbers(9, "front"), 3)).toEqual([7, 8, 9]);
  });
});

describe("hole results", () => {
  it("better ball uses best net per side", () => {
    // Hole 2: Sipho 5, Anna 6 (gets 1) vs Ruan 4, Mandla 6 (gets 1) → 5 v 4
    expect(holeWinner({ gross: [5, 6], received: [0, 1] }, { gross: [4, 6], received: [0, 1] })).toBe("B");
  });

  it("incomplete until every ball is in", () => {
    expect(holeWinner({ gross: [5, undefined], received: [0, 0] }, { gross: [4, 4], received: [0, 0] })).toBeNull();
  });

  it("a pick-up doesn't count but the partner's ball does", () => {
    expect(holeWinner({ gross: [0, 4], received: [0, 0] }, { gross: [5, 5], received: [0, 0] })).toBe("A");
    expect(holeWinner({ gross: [0], received: [0] }, { gross: [0], received: [0] })).toBe("H");
  });

  it("points per hole and formatting", () => {
    const r = pointsFor(["A", "B", "H", "A", "A", "B", "H", "B", "A", "B", "A", "H"]);
    expect(r).toEqual({ a: 6.5, b: 5.5 });
    expect(fmtPts(r.a)).toBe("6½");
    expect(fmtPts(0.5)).toBe("½");
    expect(fmtPts(4)).toBe("4");
  });
});
