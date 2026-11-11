# Player guide video — script & storyboard

Two vertical cuts for ordinary players (not organizers), rendered from the real app:

| Cut | File | Length | Use |
| --- | --- | --- | --- |
| Main | `video/out/main.mp4` | ~75 s | pinned in the group, shown at the captain's briefing |
| Teaser | `video/out/teaser.mp4` | ~21 s | dropped in the WhatsApp group on arrival day |

Format: 1080×1920 (9:16), H.264, 30 fps, **no audio**, captions burned in. Captions are
rendered *inside the page* by the recorder, so they use the app's own Barlow Condensed /
Inter stack, its navy/gold tokens, and reflow with the real UI instead of being overlaid
afterwards.

Both cuts answer the two questions new players actually ask:

1. **How does scoring work?** One phone per group; tap the number for par, `+`/`−` to adjust,
   `Save hole N`. Everyone else just watches.
2. **Where do I follow the tour?** The **Live** tab (tour tally + every match in play),
   **Standings** (day/session recap), **Matches** (pairings, tee times, results) — and the
   **Grand Reveal**, which opens the last three holes of each day.

## Storyboard — main cut

| # | Scene | On screen | Caption | ~s |
| --- | --- | --- | --- | --- |
| 1 | `01-intro` | title card over Live | *Your tour, in your pocket* — “The scorecard · Live coverage · 60 seconds” | 4 |
| 2 | `02-live` | Live header: tour tally, points to win, this session | **Live is home: the tour tally** — “Points from every match, updated as groups save” | 5.5 |
| 3 | `03-hidden` | gold “Holes 16–18 are hidden until the Grand Reveal” callout | **The last 3 holes stay sealed** — “Only your group sees them until the Grand Reveal” | 5.8 |
| 4 | `04-live-matches` | Live matches list | **Every group's match, hole by hole** — “So you can follow the other games, not just yours” | 5.2 |
| 5 | `05-reveal` | Grand Reveal drumroll → day result → Standings | **When a day is called, the drumroll starts** / “Every player sees the same reveal” / **Then the standings settle it** | 10.6 |
| 6 | `06-matches` | Matches tab: days, sessions, results | **Matches: who you play, when, and the result** — “Pairings stay blind until the captains lock them in” | 5.3 |
| 7 | `07-scorecard` | Live → gold “Score hole N” → card → par taps → Save → auto-advance | **Scoring starts from the Live tab** / “It opens on the hole you're playing” / **All four in — tap Save hole N** / “Saved in a second…” / “It moves to the next hole on its own” | 18.3 |
| 8 | `08-offline` | card with network off → “Offline · 4 saved on phone” → back online → Syncing → Synced | **No signal on the back nine? It still works** / “Saved on the phone, waiting for signal” / **Signal back: it syncs itself** | 13.5 |
| 9 | `09-me` | Me: handicap, course handicap, home-screen tip | **Your handicap, course handicap and tips** — “Add it to your home screen for the weekend” | 4.3 |
| 10 | `10-outro` | end card | *Scorecard. Live tally. Done.* — “One scorer per group · Everyone follows on the Live tab” | 4.7 |

## Storyboard — teaser

| # | Scene | Caption | ~s |
| --- | --- | --- | --- |
| 1 | `t1-intro` | *The tour app in 20 seconds* | 2.8 |
| 2 | `t2-live` | **Live tally, updated as groups save** | 3.1 |
| 3 | `t3-hidden` | **Last 3 holes sealed until the Grand Reveal** | 2.8 |
| 4 | `t4-save` | **One phone per group keeps the card** → “Saved. Everyone sees it instantly” | 7.6 |
| 5 | `t5-offline` | **No signal? It saves on the phone and syncs later** | 3.9 |
| 6 | `t6-outro` | *Scorecard. Live tally. Done.* | 2.7 |

The teaser is a strict subset of the main cut's claims — nothing is promised there that the
long cut doesn't show.

## Regenerating

```bash
npx playwright install chromium   # once per machine
npm run video                     # = just video: build + seed + record + assemble
```

Flags:

```bash
npm run video -- --skip-build              # reused the last production build
npm run video -- --skip-seed               # keep the scratch DB (continues the same tour)
npm run video -- --only=07-scorecard,08-offline   # re-record one or two beats
npm run video -- --keep                    # leave the preview server up on the printed port
npm run video -- --qa-only                 # re-run the checks against the last render (no recording)
```

Outputs (gitignored):

```
video/out/main.mp4               main cut
video/out/teaser.mp4             teaser
video/out/storyboard-*.png       contact sheet per cut (quick review)
video/.qa/*.png                  one still per caption beat
video/.qa/report.json            layout assertions per beat
```

## How it works

`scripts/make-video.ts`:

1. Seeds a **scratch** DB (`data/video-demo.db`, `npm run seed -- --demo`) — never
   `data/local.db` — then drops the draft PM session so the live day plays one session and
   the hidden-hole rule is actually visible (hidden holes are a day-level decision: only
   the day's last session hides its closing holes).
2. `next build` + `next start` on a free port with a throwaway `SESSION_SECRET`, then
   asserts the served HTML references hashed production chunks (a stray `next dev` writing
   into `.next` is the one thing that reliably breaks a take).
3. Warms one browser state — logged in as **JP** (`jp@example.com`, a non-organizer scorer
   whose group is thru 10, so holes 11+ are live) with the day-reveal overlay dismissed —
   and reuses it for every scene. Without it, the Grand Reveal drumroll covers the first
   four seconds of every take.
4. Records each scene in its own context (`540×960` CSS, `deviceScaleFactor 2` → native
   1080×1920), painting the caption bar, tap indicator and title/end cards in-page.
5. Trims each take to the time the scene actually ran, normalises to 30 fps/
   yuv420p, cross-fades the scenes (`xfade`), then delivers H.264 + faststart.
6. Verifies itself:
   - **layout** — every caption beat is inside the frame, not clipped, clear of fixed/sticky
     chrome (except the deliberate full-screen reveal/card beats) and resolves to the app font;
   - **pixels** — the caption bar and glyph brightness are sampled from the QA stills, so a
     washed-out or invisible caption fails the run rather than shipping;
   - **content** — every scene asserts the expected page text was on screen at the end, which
     is what caught two takes that had recorded a blank page;
   - **encode** — `ffprobe` for 1080×1920 / h264 and `blackdetect` for accidental black spans;
   - **blast radius** — `data/local.db` is hashed before and after; the step fails if it moved.

## Editing captions

Captions live in `scripts/video-scenes.ts` (`ctx.caption(main, sub)`), one call per beat —
edit the strings, re-run, done. Keep `main` under ~44 characters and `sub` under ~60 so the
bar stays two lines at phone size; the runner screenshots each beat and flags clipping.

Hole numbers are read from the DOM (`ctx.saveLabel()`), so the script keeps working when the
seeded tour has played a different number of holes. Don't hard-code hole numbers in captions.

## Caveats

- Stop any `next dev` before rendering — both write `.next`, and a dev manifest changes the
  chunk names the server advertises.
- First run downloads the Playwright Chromium build (~100 MB, cached in
  `~/Library/Caches/ms-playwright`).
- The videos are silent by design: autoplay in mobile browsers and chat previews is the
  whole point. If a narrated version is ever wanted, add an audio track in `assemble()`
  rather than changing the scenes.
