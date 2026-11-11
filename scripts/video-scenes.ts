/**
 * Scene list for the player-guide videos (issue #30).
 *
 * Captions live here on purpose: edit the strings, re-run `npm run video`,
 * and both cuts are re-rendered against the real UI. Captions are drawn
 * *inside* the page (see scripts/make-video.ts) so they use the app's own
 * Barlow Condensed / Inter stack and keep their measured layout.
 *
 * Total runtimes: MAIN ~72 s, TEASER ~20 s.
 */
import type { Locator, Page } from "playwright";

export interface VideoCtx {
  page: Page;
  base: string;
  /** Navigate to an app route and restore the caption/card overlay. */
  open(route: string): Promise<void>;
  /** Bottom caption bar. `sub` is the smaller second line. */
  caption(main: string, sub?: string): Promise<void>;
  /** Full-screen card (title / end beat). Pass null to dismiss. */
  card(card: { kicker?: string; title: string; lines?: string[] } | null): Promise<void>;
  tap(target: Locator): Promise<void>;
  tapText(text: string | RegExp): Promise<void>;
  /** Tap the big score number to accept par for one player. */
  tapPar(name: string): Promise<void>;
  hold(seconds: number): Promise<void>;
  offline(on: boolean): Promise<void>;
  /** Forget the "day revealed" flag so the Grand Reveal plays again. */
  resetReveal(): Promise<void>;
  waitFor(text: string | RegExp): Promise<void>;
  /** Current "Save hole N" button label, so captions follow the live data. */
  saveLabel(): Promise<string>;
}

export interface Scene {
  id: string;
  /** Text that must be on screen when the take ends — a cheap "did we film the right page" check. */
  expect: RegExp;
  run(ctx: VideoCtx): Promise<void>;
}

/** Set in make-video.ts from the seeded DB. */
export const tour = {
  liveSession: "",
  scoreHole: 11,
  nextHole: 12,
  offHole: 13,
  /** better_ball: one row per player in the group */
  group: [] as string[],
};

const sleep = (ctx: VideoCtx, s: number) => ctx.hold(s);

// ── Main cut (~72 s) ─────────────────────────────────────────────────────

export const MAIN_SCENES: Scene[] = [
  {
    id: "01-intro",
    expect: /Your tour, in your pocket/,
    run: async (ctx) => {
      await ctx.open("/live");
      await ctx.card({
        kicker: "Nkonyeni Golf Tour 2026",
        title: "Your tour, in your pocket",
        lines: ["The scorecard", "Live coverage", "60 seconds"],
      });
      await sleep(ctx, 3.4);
      await ctx.card(null);
    },
  },
  {
    id: "02-live",
    expect: /Live matches/,
    run: async (ctx) => {
      await ctx.open("/live");
      await ctx.caption("Live is home: the tour tally", "Points from every match, updated as groups save");
      await sleep(ctx, 4.6);
    },
  },
  {
    id: "03-hidden",
    expect: /are hidden until the Grand Reveal/,
    run: async (ctx) => {
      await ctx.open("/live");
      await ctx.caption("The last 3 holes stay sealed", "Only your group sees them until the Grand Reveal");
      await ctx.page.getByText(/are hidden until the Grand Reveal/).first().scrollIntoViewIfNeeded();
      await sleep(ctx, 4.8);
    },
  },
  {
    id: "04-live-matches",
    expect: /Live matches/,
    run: async (ctx) => {
      await ctx.open("/live");
      await ctx.caption("Every group's match, hole by hole", "So you can follow the other games, not just yours");
      await ctx.page.getByText("Live matches").first().scrollIntoViewIfNeeded();
      await sleep(ctx, 4.2);
    },
  },
  {
    id: "05-reveal",
    expect: /OVERALL STANDINGS|Standings/i,
    run: async (ctx) => {
      await ctx.open("/live");
      await ctx.resetReveal();
      await ctx.open("/live");
      await ctx.caption("When a day is called, the drumroll starts", "Hidden holes come in, the day is decided");
      await sleep(ctx, 3.0);
      await ctx.caption("Every player sees the same reveal", "On their own phone, at their own pace");
      await sleep(ctx, 1.3);
      await ctx.tapText(/See the standings/);
      await sleep(ctx, 0.9);
      await ctx.open("/standings");
      await ctx.caption("Then the standings settle it", "Day by day, session by session");
      await sleep(ctx, 2.5);
    },
  },
  {
    id: "06-matches",
    expect: /Matches/,
    run: async (ctx) => {
      await ctx.open("/matches");
      await ctx.caption("Matches: who you play, when, and the result", "Pairings stay blind until the captains lock them in");
      await sleep(ctx, 4.4);
    },
  },
  {
    id: "07-scorecard",
    expect: /Save hole|Saved|Hole/,
    run: async (ctx) => {
      await ctx.open("/live");
      await ctx.caption("Scoring starts from the Live tab", "One phone per group — tap Score hole");
      await sleep(ctx, 1.9);
      await ctx.tapText(/^Score hole/);
      await sleep(ctx, 0.9);
      await ctx.caption("It opens on the hole you're playing", "Tap the number to accept par, or + and − to adjust");
      await sleep(ctx, 2.2);
      for (const name of tour.group) {
        await ctx.tapPar(name);
        await sleep(ctx, 0.45);
      }
      const save = await ctx.saveLabel();
      await ctx.caption(`All four in — tap ${save}`, "Par for the hole, or + and − to adjust");
      await sleep(ctx, 1.5);
      await ctx.tapText(save);
      await sleep(ctx, 0.9);
      await ctx.caption("Saved in a second. The group sees it instantly", "Your tally updates on every phone");
      await sleep(ctx, 1.9);
      await ctx.caption("It moves to the next hole on its own", "Previous, Save, Next — that's the whole card");
      await sleep(ctx, 2.1);
    },
  },
  {
    id: "08-offline",
    expect: /Synced|Syncing/,
    run: async (ctx) => {
      await ctx.open(`/score/${tour.liveSession}`);
      await ctx.caption("No signal on the back nine? It still works", "The card saves on the phone first");
      await sleep(ctx, 1.2);
      await ctx.offline(true);
      await sleep(ctx, 0.8);
      for (const name of tour.group) {
        await ctx.tapPar(name);
        await sleep(ctx, 0.4);
      }
      await ctx.caption("Saved on the phone, waiting for signal", "Nothing is lost — just queue it");
      await sleep(ctx, 1.9);
      await ctx.tapText(await ctx.saveLabel());
      await sleep(ctx, 1.6);
      await ctx.offline(false);
      await ctx.caption("Signal back: it syncs itself", "Keep the app open and the queue drains");
      await ctx.waitFor(/Syncing|Synced/);
      await sleep(ctx, 2.6);
    },
  },
  {
    id: "09-me",
    expect: /Handicap index/,
    run: async (ctx) => {
      await ctx.open("/me");
      await ctx.caption("Your handicap, course handicap and tips", "Add it to your home screen for the weekend");
      await sleep(ctx, 3.4);
    },
  },
  {
    id: "10-outro",
    expect: /Scorecard. Live tally. Done./,
    run: async (ctx) => {
      await ctx.open("/live");
      await ctx.card({
        kicker: "Enjoy the tour",
        title: "Scorecard. Live tally. Done.",
        lines: ["One scorer per group", "Everyone follows on the Live tab"],
      });
      await sleep(ctx, 4.0);
    },
  },
];

// ── Teaser (~20 s) ───────────────────────────────────────────────────────

export const TEASER_SCENES: Scene[] = [
  {
    id: "t1-intro",
    expect: /in 20 seconds/,
    run: async (ctx) => {
      await ctx.open("/live");
      await ctx.card({ kicker: "Nkonyeni Golf Tour 2026", title: "The tour app in 20 seconds" });
      await sleep(ctx, 2.0);
      await ctx.card(null);
    },
  },
  {
    id: "t2-live",
    expect: /Live matches/,
    run: async (ctx) => {
      await ctx.open("/live");
      await ctx.caption("Live tally, updated as groups save");
      await sleep(ctx, 2.2);
    },
  },
  {
    id: "t3-hidden",
    expect: /are hidden until the Grand Reveal/,
    run: async (ctx) => {
      await ctx.open("/live");
      await ctx.caption("Last 3 holes sealed until the Grand Reveal");
      await ctx.page.getByText(/are hidden until the Grand Reveal/).first().scrollIntoViewIfNeeded();
      await sleep(ctx, 1.9);
    },
  },
  {
    id: "t4-save",
    expect: /Save hole|Hole/,
    run: async (ctx) => {
      await ctx.open(`/score/${tour.liveSession}`);
      await ctx.caption("One phone per group keeps the card");
      await sleep(ctx, 1.0);
      for (const name of tour.group) {
        await ctx.tapPar(name);
        await sleep(ctx, 0.32);
      }
      await ctx.tapText(/^Save hole/);
      await sleep(ctx, 0.8);
      await ctx.caption("Saved. Everyone sees it instantly");
      await sleep(ctx, 1.1);
    },
  },
  {
    id: "t5-offline",
    expect: /Offline|Synced|Syncing|Saved/,
    run: async (ctx) => {
      await ctx.open(`/score/${tour.liveSession}`);
      await ctx.offline(true);
      await ctx.caption("No signal? It saves on the phone and syncs later");
      await sleep(ctx, 1.5);
      await ctx.offline(false);
      await sleep(ctx, 1.5);
    },
  },
  {
    id: "t6-outro",
    expect: /Scorecard. Live tally. Done./,
    run: async (ctx) => {
      await ctx.open("/live");
      await ctx.card({ kicker: "Enjoy the tour", title: "Scorecard. Live tally. Done." });
      await sleep(ctx, 2.0);
    },
  },
];
