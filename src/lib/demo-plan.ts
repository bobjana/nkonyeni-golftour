// Pure demo timeline: which simulated step happens when. Times are demo
// seconds from the start; the clock in lib/demo.ts scales them by speed.
import type { Format } from "./db/types";
import { FORMAT_LABEL } from "./scoring";

export type DemoStep =
  | { kind: "open"; session: string }
  | { kind: "submit"; session: string; team: number; slots: string[][] }
  | { kind: "publish"; session: string; scorers: string[] }
  | { kind: "hole"; session: string; group: number; hole: number }
  | { kind: "complete"; session: string }
  | { kind: "reveal"; day: string }
  | { kind: "end" };

export type DemoAction = DemoStep & {
  t: number;
  /** activity-feed line */
  text: string;
  /** set on the moments "Skip to next" jumps between */
  moment?: string;
};

export interface DemoPlan {
  seed: number;
  actions: DemoAction[];
}

export interface PlanInput {
  seed: number;
  teams: { id: string; name: string; players: { id: string; name: string }[] }[];
  days: {
    id: string;
    number: number;
    sessions: { id: string; slot: "AM" | "PM"; format: Format; played: number[]; hidden: number[] }[];
  }[];
}

/** Seconds between holes for one group, and between the steps around them. */
export const PACE = { hole: 15, open: 5, submitA: 20, submitB: 15, publish: 15, firstTee: 10, groupGap: 20, nextSession: 20, reveal: 25 };

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Gross strokes a simulated player makes: net par give or take, leaning a
 * little over. Picks up now and then in better ball, where a partner covers.
 */
export function demoGross(rand: () => number, par: number, received: number, canPickUp: boolean): number {
  if (canPickUp && rand() < 0.04) return 0;
  const r = rand();
  const delta = r < 0.1 ? -1 : r < 0.5 ? 0 : r < 0.82 ? 1 : r < 0.95 ? 2 : 3;
  return Math.max(2, par + received + delta);
}

export function buildPlan(input: PlanInput): DemoPlan {
  const rand = mulberry32(input.seed);
  const actions: DemoAction[] = [];
  const [ta, tb] = input.teams;
  let t = 0;

  for (const day of input.days) {
    for (const s of day.sessions) {
      const name = `Day ${day.number} ${s.slot} ${FORMAT_LABEL[s.format].toLowerCase()}`;
      const singles = s.format === "singles";
      const slotsFor = (team: PlanInput["teams"][number]) => {
        const ids = shuffle(team.players.map((p) => p.id), rand);
        if (singles) return ids.map((id) => [id]);
        const pairs: string[][] = [];
        for (let i = 0; i + 1 < ids.length; i += 2) pairs.push([ids[i], ids[i + 1]]);
        return pairs;
      };
      const slotsA = slotsFor(ta);
      const slotsB = slotsFor(tb);
      const matches = Math.min(slotsA.length, slotsB.length);
      const groups = singles ? Math.ceil(matches / 2) : matches;
      const groupPlayers = (g: number) => {
        const ms = singles ? [2 * g - 2, 2 * g - 1].filter((i) => i < matches) : [g - 1];
        return ms.flatMap((i) => [...slotsA[i], ...slotsB[i]]);
      };
      const scorers = Array.from({ length: groups }, (_, i) => {
        const ps = groupPlayers(i + 1);
        return ps[Math.floor(rand() * ps.length)];
      });

      t += PACE.open;
      actions.push({ t, kind: "open", session: s.id, text: `Pairings open for ${name}`, moment: `Pairings open · ${name}` });
      t += PACE.submitA;
      actions.push({ t, kind: "submit", session: s.id, team: 0, slots: slotsA, text: `${ta.name} captain submits pairings` });
      t += PACE.submitB;
      actions.push({ t, kind: "submit", session: s.id, team: 1, slots: slotsB, text: `${tb.name} captain submits pairings` });
      t += PACE.publish;
      actions.push({ t, kind: "publish", session: s.id, scorers, text: `Draw published · ${name} is live`, moment: `Draw published · ${name}` });

      let end = t;
      for (let g = 1; g <= groups; g++) {
        const start = t + PACE.firstTee + (g - 1) * PACE.groupGap;
        s.played.forEach((hole, i) => {
          const at = start + i * PACE.hole;
          const hidden = s.hidden[0] === hole && g === 1;
          actions.push({
            t: at,
            kind: "hole",
            session: s.id,
            group: g,
            hole,
            text: `Group ${g} enters hole ${hole}`,
            ...(hidden ? { moment: `Hidden holes begin · ${name}` } : {}),
          });
          end = Math.max(end, at);
        });
      }
      t = end + 2;
      actions.push({ t, kind: "complete", session: s.id, text: `${name} complete`, moment: `Last putt · ${name}` });
      t += PACE.nextSession;
    }
    t += PACE.reveal - PACE.nextSession;
    actions.push({ t, kind: "reveal", day: day.id, text: `Grand reveal for Day ${day.number}`, moment: `Grand reveal · Day ${day.number}` });
  }
  t += 10;
  actions.push({ t, kind: "end", text: "Demo finished", moment: "Final result" });
  actions.sort((a, b) => a.t - b.t);
  return { seed: input.seed, actions };
}
