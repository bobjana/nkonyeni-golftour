import type { Format } from "./db/types";

/** WHS allowances per format (foursomes applies to the pair's combined handicap). */
export const ALLOWANCE: Record<Format, number> = {
  better_ball: 0.9,
  singles: 1,
  foursomes: 0.5,
};

export const FORMAT_LABEL: Record<Format, string> = {
  better_ball: "Better ball",
  foursomes: "Foursomes",
  singles: "Singles",
};

export interface Hole {
  number: number;
  par: number;
  si: number;
}

export interface TeeRating {
  rating: number;
  slope: number;
}

/** Course handicap = HI × Slope / 113 + (CR − Par), rounded to the nearest whole number. */
export function courseHandicap(hi: number, tee: TeeRating, par: number): number {
  return Math.round((hi * tee.slope) / 113 + (tee.rating - par));
}

/** Hole numbers played in a session: all 18, or the front/back nine. */
export function sessionHoleNumbers(holes: number, nine: "front" | "back"): number[] {
  if (holes === 18) return Array.from({ length: 18 }, (_, i) => i + 1);
  const start = nine === "back" ? 10 : 1;
  return Array.from({ length: 9 }, (_, i) => start + i);
}

/** The last `n` holes of the session, which stay hidden until the day's reveal. */
export function hiddenHoleNumbers(played: number[], n: number): number[] {
  return n > 0 ? played.slice(-n) : [];
}

/**
 * Strokes each match entity receives over the session. `courseHcps` is one
 * entry per entity: a player's course handicap, or for foursomes the two
 * partners' course handicaps. Strokes are given off the lowest entity.
 */
export function matchStrokes(format: Format, courseHcps: number[][], holesPlayed: number): number[] {
  const playing = courseHcps.map((hcps) => {
    const total = hcps.reduce((a, b) => a + b, 0);
    return Math.round(total * ALLOWANCE[format]);
  });
  const low = Math.min(...playing);
  return playing.map((p) => {
    const diff = p - low;
    return holesPlayed === 9 ? Math.round(diff / 2) : diff;
  });
}

/**
 * Strokes received on one hole. Holes are ranked by stroke index within the
 * holes played, so on a nine the hardest hole of that nine gets the first stroke.
 */
export function strokesOnHole(strokes: number, hole: Hole, played: Hole[]): number {
  if (strokes <= 0) return 0;
  const n = played.length;
  const rank = [...played].sort((a, b) => a.si - b.si).findIndex((h) => h.number === hole.number) + 1;
  return Math.floor(strokes / n) + (rank <= strokes % n ? 1 : 0);
}

export type HoleWinner = "A" | "B" | "H";

/**
 * One side's entries for a hole: gross strokes per entity (0 = picked up,
 * undefined = not entered yet) and the strokes each receives on this hole.
 */
export interface SideEntry {
  gross: (number | undefined)[];
  received: number[];
}

/** Best net score for a side, Infinity if every ball picked up, null if incomplete. */
export function bestNet(side: SideEntry): number | null {
  if (side.gross.some((g) => g === undefined)) return null;
  const nets = side.gross.map((g, i) => (g === 0 ? Infinity : (g as number) - side.received[i]));
  return Math.min(...nets);
}

export function holeWinner(a: SideEntry, b: SideEntry): HoleWinner | null {
  const na = bestNet(a);
  const nb = bestNet(b);
  if (na === null || nb === null) return null;
  if (na === nb) return "H";
  return na < nb ? "A" : "B";
}

export function pointsFor(results: (HoleWinner | null)[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const r of results) {
    if (r === "A") a += 1;
    else if (r === "B") b += 1;
    else if (r === "H") {
      a += 0.5;
      b += 0.5;
    }
  }
  return { a, b };
}

/** 6.5 → "6½", 0.5 → "½", 7 → "7" */
export function fmtPts(x: number): string {
  const whole = Math.floor(x);
  if (x - whole === 0) return String(whole);
  return whole === 0 ? "½" : `${whole}½`;
}
