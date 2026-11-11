/**
 * Renders the player-guide videos (issue #30) straight from the real app.
 *
 *   npm run video              # seed a scratch DB, build, record both cuts, assemble
 *   npm run video -- --skip-build --only=07-scorecard
 *   npm run video -- --keep    # leave the server running (prints the URL)
 *
 * Safety: always uses data/video-demo.db (never data/local.db), a spare port,
 * and DEMO_DISABLED is left alone. Re-running wipes and re-seeds the scratch DB.
 *
 * Pipeline per scene: playwright webm -> ffmpeg normalise (1080x1920/30fps) ->
 * xfade chain -> H.264 faststart. Captions are painted inside the page so the
 * app's own fonts, tokens and layout do the typography.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { chromium, type Browser, type Locator, type Page } from "playwright";
import { MAIN_SCENES, TEASER_SCENES, tour, type Scene, type VideoCtx } from "./video-scenes";

const ROOT = path.resolve(import.meta.dirname, "..");
const DB_REL = "data/video-demo.db";
const DB_PATH = path.join(ROOT, DB_REL);
const OUT = path.join(ROOT, "video/out");
const RAW = path.join(ROOT, "video/.raw");
const QA = path.join(ROOT, "video/.qa");
const VIEW = { width: 540, height: 960 };
const REC = { width: 1080, height: 1920 };
const FADE = 0.28;
const SECRET = "video-demo-session-secret";

const QA_LOG: QaEntry[] = [];
/** How long each take really ran, so the encode can drop the recorder's tail. */
const SCENE_SECONDS = new Map<string, number>();

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const only = opt("only")?.split(",");

// ── shell helpers ───────────────────────────────────────────────────────────

function run(cmd: string, argv: string[], opts: { cwd?: string; env?: Record<string, string>; quiet?: boolean } = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, argv, { cwd: opts.cwd ?? ROOT, env: { ...process.env, ...opts.env }, stdio: ["ignore", "pipe", "pipe"] });
    let tail = "";
    const keep = (b: Buffer) => {
      if (opts.quiet) return;
      tail = (tail + b.toString()).slice(-4000);
    };
    child.stdout?.on("data", keep);
    child.stderr?.on("data", keep);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${argv.join(" ")} exited ${code}\n${tail}`))));
  });
}

const capture = (cmd: string, argv: string[]) =>
  new Promise<string>((resolve, reject) => {
    const child = spawn(cmd, argv, { cwd: ROOT });
    let out = "";
    child.stdout.on("data", (b) => (out += b.toString()));
    child.stderr.on("data", () => {});
    child.on("exit", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`${cmd} exited ${code}`))));
  });

async function freePort() {
  return new Promise<number>((resolve) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHttp(url: string, timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`server never answered ${url}`);
}

// ── seed + data ─────────────────────────────────────────────────────────────

async function seed() {
  for (const suffix of ["", "-shm", "-wal"]) await fs.rm(DB_PATH + suffix, { force: true });
  console.log("· seeding scratch DB", DB_REL);
  await run("npm", ["run", "seed", "--", "--demo"], { env: { DATABASE_URL: `file:./${DB_REL}` }, quiet: true });
}

/**
 * Video fixture: the seeded demo has a draft PM session on the live day, and
 * hidden holes are a day-level decision ("only the day's last session hides
 * its closing holes"), so with two sessions nothing is hidden anywhere.
 * Drop the draft session from the scratch DB so the live day plays one
 * session and the Grand Reveal rule is visible, as it is on a real tour day.
 */
function fixture() {
  const db = new DatabaseSync(DB_PATH);
  const live = db.prepare("select id, day_id from sessions where status = 'live'").get() as { id: string; day_id: string };
  const dropped = db.prepare("delete from sessions where day_id = ? and status = 'draft'").run(live.day_id);
  db.close();
  console.log(`· fixture: live day now plays one session (dropped ${dropped.changes} draft)`);
}

function readTour() {
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const live = db.prepare("select id from sessions where status = 'live' order by slot limit 1").get() as { id?: string } | undefined;
  if (!live?.id) throw new Error("no live session in the seeded DB");
  const me = db.prepare("select id from players where email = 'jp@example.com'").get() as { id: string };
  const match = db
    .prepare("select id, pairing_a_id, pairing_b_id from matches where session_id = ? and scorer_id = ?")
    .get(live.id, me.id) as { id: string; pairing_a_id: string; pairing_b_id: string } | undefined;
  if (!match) throw new Error("player JP is not the scorer of a live match");
  const names: string[] = [];
  for (const pairingId of [match.pairing_a_id, match.pairing_b_id]) {
    const p = db.prepare("select player1_id, player2_id from pairings where id = ?").get(pairingId) as { player1_id: string; player2_id: string };
    for (const pid of [p.player1_id, p.player2_id]) {
      names.push((db.prepare("select name from players where id = ?").get(pid) as { name: string }).name.split(" ")[0]);
    }
  }
  const token = (db.prepare("select invite_token from players where id = ?").get(me.id) as { invite_token: string }).invite_token;
  const open = db
    .prepare("select distinct hole from scores where match_id = ? order by hole")
    .all(match.id) as { hole: number }[];
  const thru = open.length ? Math.max(...open.map((r) => r.hole)) : 0;
  db.close();
  tour.liveSession = live.id;
  tour.group = names;
  tour.scoreHole = thru + 1;
  tour.nextHole = thru + 2;
  tour.offHole = thru + 3;
  return { token };
}

// ── in-page overlay (captions, tap indicator, cards) ─────────────────────────

const CAPTION_CSS = [
  "#vt-caption{position:fixed;left:16px;right:16px;bottom:198px;z-index:2147483646;pointer-events:none;",
  "opacity:0;transform:translateY(10px);transition:opacity .28s ease,transform .28s ease;",
  "border-radius:16px;background:linear-gradient(180deg,rgba(9,26,49,.94),rgba(6,18,34,.97));",
  "box-shadow:0 10px 30px rgba(0,0,0,.35);padding:14px 16px 15px;border:1px solid rgba(201,162,39,.28)}",
  "#vt-caption.vt-on{opacity:1;transform:none}",
  "#vt-caption .m{font-family:var(--font-inter),system-ui,sans-serif;font-size:20px;line-height:1.24;font-weight:700;color:#fff;letter-spacing:-.01em}",
  "#vt-caption .s{margin-top:4px;font-family:var(--font-inter),system-ui,sans-serif;font-size:14px;line-height:1.3;font-weight:500;color:#c9d3e2}",
  "#vt-caption .s:empty{display:none}",
  "#vt-dot{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:56px;height:56px;margin:-28px 0 0 -28px;",
  "border-radius:999px;opacity:0;transition:transform .34s cubic-bezier(.4,0,.2,1),opacity .18s ease;",
  "background:radial-gradient(circle,rgba(255,255,255,.92) 0 30%,rgba(255,255,255,.35) 55%,rgba(255,255,255,0) 72%)}",
  "#vt-dot.vt-on{opacity:1}",
  "#vt-dot::after{content:'';position:absolute;inset:0;border-radius:999px;border:2px solid rgba(255,255,255,.65);",
  "opacity:0;animation:vt-tap .5s ease-out}",
  "#vt-dot.vt-tapped::after{opacity:1}",
  "@keyframes vt-tap{from{transform:scale(.45);opacity:.9}to{transform:scale(1.15);opacity:0}}",
  "#vt-card{position:fixed;inset:0;z-index:2147483645;display:none;flex-direction:column;align-items:center;justify-content:center;",
  "gap:18px;text-align:center;padding:48px 32px;background:radial-gradient(120% 90% at 50% 0%,#16365d 0%,#0a1c33 55%,#050f1c 100%)}",
  "#vt-card.vt-on{display:flex}",
  "#vt-card .k{font-family:var(--font-barlow),system-ui,sans-serif;font-size:15px;font-weight:700;letter-spacing:.22em;",
  "text-transform:uppercase;color:#c9a227}",
  "#vt-card .t{font-family:var(--font-barlow),system-ui,sans-serif;font-size:44px;line-height:1.02;font-weight:700;color:#fff;",
  "letter-spacing:-.01em;max-width:9em}",
  "#vt-card .l{display:flex;flex-direction:column;gap:10px;margin-top:6px}",
  "#vt-card .l span{font-family:var(--font-inter),system-ui,sans-serif;font-size:17px;font-weight:600;color:#dbe4f0}",
  "#vt-card .l span::before{content:'';display:inline-block;width:6px;height:6px;margin-right:10px;border-radius:999px;",
  "background:#c9a227;vertical-align:middle}",
].join("");

const INIT_JS = `(function(){
  var css = ${JSON.stringify(CAPTION_CSS)};
  function ensure() {
    if (!document.documentElement) return;
    if (!document.getElementById("vt-style")) {
      var s = document.createElement("style");
      s.id = "vt-style"; s.textContent = css;
      document.head ? document.head.appendChild(s) : document.documentElement.appendChild(s);
    }
    var host = document.body;
    if (!host) return;
    if (!document.getElementById("vt-caption")) {
      var c = document.createElement("div");
      c.id = "vt-caption"; c.innerHTML = '<div class="m"></div><div class="s"></div>';
      host.appendChild(c);
    }
    if (!document.getElementById("vt-dot")) {
      var d = document.createElement("div"); d.id = "vt-dot";
      host.appendChild(d);
    }
    if (!document.getElementById("vt-card")) {
      var k = document.createElement("div"); k.id = "vt-card";
      k.innerHTML = '<div class="k"></div><div class="t"></div><div class="l"></div>';
      host.appendChild(k);
    }
  }
  window.__vt = {
    ensure: ensure,
    caption: function (main, sub) {
      ensure();
      var c = document.getElementById("vt-caption");
      c.querySelector(".m").textContent = main || "";
      c.querySelector(".s").textContent = sub || "";
      c.classList.toggle("vt-on", !!main);
    },
    card: function (obj) {
      ensure();
      var k = document.getElementById("vt-card");
      if (!obj) { k.classList.remove("vt-on"); return; }
      k.querySelector(".k").textContent = obj.kicker || "";
      k.querySelector(".t").textContent = obj.title || "";
      var l = k.querySelector(".l");
      l.textContent = "";
      (obj.lines || []).forEach(function (t) {
        var s = document.createElement("span"); s.textContent = t; l.appendChild(s);
      });
      k.classList.add("vt-on");
    },
    dot: function (x, y) {
      ensure();
      var d = document.getElementById("vt-dot");
      d.style.transform = "translate(" + x + "px," + y + "px)";
      d.classList.add("vt-on");
    },
    tapFlash: function () {
      var d = document.getElementById("vt-dot");
      d.classList.remove("vt-tapped");
      void d.offsetWidth;
      d.classList.add("vt-tapped");
    }
  };
})();`;

// ── per-scene recording context ─────────────────────────────────────────────

interface QaEntry {
  scene: string;
  caption: string;
  top: number;
  bottom: number;
  fontPx: number;
  fontFamily: string;
  visible: boolean;
  overlayBeat?: boolean;
  still?: string;
  clipped: boolean;
  overlaps: string[];
}

/** DOM-level QA: the caption must stay inside the frame and clear of sticky/fixed chrome. */
async function inspectCaption(page: Page) {
  return page.evaluate(() => {
    const cap = document.getElementById("vt-caption");
    if (!cap) return null;
    const r = cap.getBoundingClientRect();
    const main = cap.querySelector(".m") as HTMLElement | null;
    const fontPx = main ? parseFloat(getComputedStyle(main).fontSize) : 0;
    const clipped = cap.scrollHeight > cap.clientHeight + 1 || r.left < 0 || r.right > innerWidth + 1;
    const overlaps: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      if (el.id.startsWith("vt-") || el.closest("#vt-caption")) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") continue;
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      const b = el.getBoundingClientRect();
      if (b.width * b.height < 400) continue;
      const hit = !(b.right < r.left || b.left > r.right || b.bottom < r.top || b.top > r.bottom);
      if (hit) overlaps.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")}`);
    }
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      fontPx,
      fontFamily: main ? getComputedStyle(main).fontFamily.split(",")[0].replace(/["']/g, "") : "",
      visible: Number(getComputedStyle(cap).opacity) > 0.9 && r.height > 20,
      clipped,
      overlaps,
    };
  });
}

interface CtxExtra { displayed: string[] }

function makeCtx(page: Page, base: string, tag: string, qa: QaEntry[], extra: CtxExtra): VideoCtx {
  let last = { main: "", sub: "" };
  let lastCard: { kicker?: string; title: string; lines?: string[] } | null = null;
  const apply = () =>
    page.evaluate(
      (s) => {
        const vt = (window as unknown as { __vt: { ensure(): void; caption(m: string, s2: string): void; card(o: unknown): void } }).__vt;
        vt?.ensure();
        vt?.caption(s.main, s.sub);
        vt?.card(s.card);
      },
      { ...last, card: lastCard },
    );
  const note = (t: string) => {
    if (t) extra.displayed.push(t);
  };
  const dot = async (x: number, y: number) => {
    await page.evaluate((p) => (window as unknown as { __vt: { dot(a: number, b: number): void } }).__vt?.dot(p.x, p.y), { x, y });
    await page.waitForTimeout(80);
    await page.evaluate(() => (window as unknown as { __vt: { tapFlash(): void } }).__vt?.tapFlash());
  };
  let shotN = 0;
  const ctx: VideoCtx = {
    page,
    base,
    open: async (route) => {
      await page.goto(base + route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(320);
      await apply();
    },
    caption: async (main, sub) => {
      last = { main, sub: sub ?? "" };
      note(main);
      note(sub ?? "");
      await apply();
      await page.waitForTimeout(340);
      // QA stills: one per caption beat, so frames can be eyeballed before encoding.
      await page.screenshot({ path: path.join(QA, `${tag}-${++shotN}.png`) });
      const still = path.join(QA, `${tag}-${shotN}.png`);
      const m = await inspectCaption(page);
      const overlayBeat = /-(01-intro|05-reveal|10-outro|t1-intro|t6-outro)$/.test(tag) || lastCard !== null;
      if (m) qa.push({ scene: tag, caption: main, overlayBeat, still, ...m });
    },
    card: async (c) => {
      lastCard = c;
      if (c) note([c.kicker ?? "", c.title, ...(c.lines ?? [])].join(" "));
      await apply();
      await page.screenshot({ path: path.join(QA, `${tag}-card-${c ? "on" : "off"}.png`) });
    },
    tap: async (target: Locator) => {
      await target.scrollIntoViewIfNeeded();
      const box = await target.boundingBox();
      if (box) await dot(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(140);
      await target.click();
      await page.waitForTimeout(120);
    },
    tapText: async (text) => ctx.tap(page.getByText(text, { exact: false }).first()),
    tapPar: async (name) => {
      const number = page.locator(`button[aria-label="One stroke more for ${name}"]`).locator("xpath=./preceding-sibling::div[1]").locator("span.font-display");
      await ctx.tap(number);
    },
    hold: (s) => page.waitForTimeout(s * 1000),
    offline: (on) => page.context().setOffline(on),
    resetReveal: () =>
      page
        .evaluate(() => {
          for (const k of Object.keys(localStorage)) if (k.startsWith("reveal:")) localStorage.removeItem(k);
        })
        .catch(() => {}),
    saveLabel: async () => (await page.locator('button:has-text("Save hole")').first().textContent())!.trim(),
    waitFor: async (text) => {
      await page.getByText(text).first().waitFor({ state: "visible", timeout: 20_000 });
    },
  };
  return ctx;
}

/**
 * Every scene starts from one pre-warmed browser state: logged in, with the
 * day-reveal overlay already dismissed. Otherwise the reveal drumroll covers
 * the first ~4 s of every take.
 */
async function warmup(browser: Browser, base: string, token: string) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(`${base}/join/${token}`, { waitUntil: "domcontentloaded" });
  // "/" lands a scorer straight on their card; the reveal notice lives on the player pages.
  await page.goto(`${base}/live`, { waitUntil: "domcontentloaded" });
  const dismiss = page.getByRole("button", { name: /See the standings/ });
  await dismiss.first().waitFor({ state: "visible", timeout: 12_000 }).catch(() => {});
  await dismiss.first().click({ timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(300);
  const state = await context.storageState();
  await context.close();
  return state;
}

async function record(browser: Browser, base: string, token: string, scenes: Scene[], prefix: string, storageState: Awaited<ReturnType<typeof warmup>>) {
  const files: string[] = [];
  for (const scene of scenes) {
    if (only && !only.includes(scene.id)) continue;
    const started = Date.now();
    let runStart = 0;
    const context = await browser.newContext({
      storageState,
      viewport: VIEW,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: "en-ZA",
      timezoneId: "Africa/Mbabane",
      recordVideo: { dir: RAW, size: REC },
    });
    await context.addInitScript(INIT_JS);
    const page = await context.newPage();
    const extra: CtxExtra = { displayed: [] };
    const ctx = makeCtx(page, base, `${prefix}-${scene.id}`, QA_LOG, extra);
    runStart = Date.now();
    try {
      await scene.run(ctx);
      const body = (await page.locator("body").innerText()) + "\n" + extra.displayed.join("\n");
      if (!scene.expect.test(body)) {
        await fs.writeFile(path.join(QA, `FAIL-${prefix}-${scene.id}.txt`), body + "\n\nURL: " + page.url());
        throw new Error(`${scene.id}: expected ${scene.expect} on screen, not found`);
      }
    } catch (err) {
      await fs.writeFile(path.join(QA, `FAIL-${prefix}-${scene.id}.txt`), (await page.locator("body").innerText().catch(() => "")) + "\n\nURL: " + page.url());
      await page.screenshot({ path: path.join(QA, `FAIL-${prefix}-${scene.id}.png`) }).catch(() => {});
      throw err;
    }
    const ranSeconds = (Date.now() - runStart) / 1000;
    await page.waitForTimeout(250);
    const video = page.video();
    await context.close();
    const raw = await video?.path();
    if (!raw) throw new Error(`no video for ${scene.id}`);
    const dest = path.join(RAW, `${prefix}-${scene.id}.webm`);
    await fs.rename(raw, dest);
    files.push(dest);
    SCENE_SECONDS.set(dest, ranSeconds);
    console.log(`  ✓ ${scene.id} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  }
  return files;
}

/** Mean/max luma of a crop of a still — pixel evidence that captions are legible. */
function luma(file: string, crop: string) {
  return new Promise<{ avg: number; max: number }>((resolve) => {
    const child = spawn("ffmpeg", ["-hide_banner", "-i", file, "-vf", `crop=${crop},format=gray,signalstats,metadata=print`, "-frames:v", "1", "-f", "null", "-"]);
    let out = "";
    child.stderr.on("data", (b: Buffer) => (out += b.toString()));
    child.on("exit", () => {
      const avg = out.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
      const max = out.match(/lavfi\.signalstats\.YMAX=([\d.]+)/);
      resolve({ avg: avg ? Number(avg[1]) : NaN, max: max ? Number(max[1]) : NaN });
    });
  });
}

/** Throws early instead of dying 40 s into the first take. */
async function preflight() {
  const problems: string[] = [];
  try {
    await fs.access(chromium.executablePath());
  } catch {
    problems.push("chromium is not installed — run `npx playwright install chromium`");
  }
  try {
    await capture("ffmpeg", ["-version"]);
  } catch {
    problems.push("ffmpeg is not on PATH — install it (brew install ffmpeg)");
  }
  if (problems.length) throw new Error(problems.join("\n"));
}

// ── ffmpeg ──────────────────────────────────────────────────────────────────

const duration = async (file: string) => Number(await capture("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]));

async function normalise(file: string, dest: string, ranSeconds: number) {
  await run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-ss", "0.15", "-i", file,
    ...(ranSeconds > 1 ? ["-t", (ranSeconds + 0.15).toFixed(2)] : []),
    "-vf", `scale=${REC.width}:${REC.height}:force_original_aspect_ratio=increase,crop=${REC.width}:${REC.height},setsar=1,fps=30,format=yuv420p`,
    "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart",
    dest,
  ], { quiet: true });
}

/** Cross-fade the normalised clips together, then a single delivery encode. */
async function assemble(clips: string[], dest: string) {
  const durations: number[] = [];
  for (const clip of clips) durations.push(await duration(clip));
  const filters: string[] = [];
  let prev = "[0:v]";
  let offset = 0;
  for (let i = 1; i < clips.length; i++) {
    offset += durations[i - 1] - FADE;
    const label = i === clips.length - 1 ? "[vout]" : `[v${i}]`;
    filters.push(`${prev}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}${label}`);
    prev = label;
  }
  const argv = ["-y", "-loglevel", "error"];
  for (const clip of clips) argv.push("-i", clip);
  if (clips.length === 1) {
    argv.push("-map", "0:v");
  } else {
    argv.push("-filter_complex", filters.join(";"), "-map", "[vout]");
  }
  argv.push("-an", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", dest);
  await run("ffmpeg", argv, { quiet: true });
  console.log(`  ✓ ${path.relative(ROOT, dest)} — ${(await duration(dest)).toFixed(1)}s`);
}

/**
 * Real pixels, not DOM: the caption bar must be dark and its glyphs bright.
 * Coordinates: QA stills are 2x the 540 CSS px viewport; the bar always sits
 * 16 CSS px from each edge, so the padding maths below is stable.
 */
async function verifyContrast() {
  let dim = 0;
  let sampled = 0;
  for (const e of QA_LOG) {
    if (!e.still || !e.visible) continue;
    sampled++;
    const top = e.top * 2;
    const bar = await luma(e.still, `24:20:44:${top + 14}`); // inside the bar, left padding
    const text = await luma(e.still, `880:56:64:${top + 30}`); // first caption line
    const ok = bar.avg < 120 && text.max >= bar.avg + 70;
    if (!ok) {
      dim++;
      console.log(`  ! low contrast ${e.scene}: bar=${bar.avg.toFixed(0)} text-max=${text.max.toFixed(0)}`);
    }
  }
  console.log(`  contrast check: ${sampled - dim}/${sampled} caption beats legible (bar luma < 120, glyphs ≥ bar + 70)`);
  if (dim) throw new Error(`${dim} caption beats have weak contrast`);
}

// ── main ────────────────────────────────────────────────────────────────────

let server: ChildProcess | undefined;

const hashOf = async (file: string) => {
  try {
    const { createHash } = await import("node:crypto");
    return createHash("sha256").update(await fs.readFile(file)).digest("hex");
  } catch {
    return "missing";
  }
};

async function main() {
  if (flag("qa-only")) {
    QA_LOG.push(...(JSON.parse(await fs.readFile(path.join(QA, "report.json"), "utf8")) as QaEntry[]));
    await verifyContrast();
    return;
  }
  await preflight();
  const realDbBefore = await hashOf(path.join(ROOT, "data/local.db"));
  await fs.mkdir(OUT, { recursive: true });
  await fs.mkdir(QA, { recursive: true });
  await fs.rm(RAW, { recursive: true, force: true });
  await fs.mkdir(RAW, { recursive: true });

  if (!flag("skip-seed")) {
    await seed();
    fixture();
  }
  const { token } = readTour();
  console.log(`· scoring POV: ${tour.group.join(" / ")} · live session ${tour.liveSession.slice(0, 8)} · holes ${tour.scoreHole}-${tour.offHole}`);

  if (!flag("skip-build")) {
    console.log("· next build");
    await run("npm", ["run", "build"], { quiet: true });
  }

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  server = spawn("npx", ["next", "start", "-p", String(port)], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: `file:./${DB_REL}`, SESSION_SECRET: SECRET, APP_URL: base },
    stdio: ["ignore", "ignore", "pipe"],
  });
  server.stderr?.on("data", (b: Buffer) => {
    const line = b.toString();
    if (/error/i.test(line)) process.stderr.write(line);
  });
  await waitForHttp(`${base}/login`);
  const html = await (await fetch(`${base}/live`)).text();
  const refs = [...html.matchAll(/\/_next\/static\/chunks\/([\w.-]+)\.js/g)].map((m) => m[1]);
  if (!refs.length || refs.includes("main-app")) {
    throw new Error("served HTML points at dev-mode chunks — a `next dev` process rewrote .next; stop it and re-run");
  }
  for (const ref of refs) {
    const res = await fetch(`${base}/_next/static/chunks/${ref}.js`);
    if (!res.ok) throw new Error(`chunk ${ref} is ${res.status} — stale .next, stop any dev server and re-run`);
  }
  console.log(`· server on ${base} (${refs.length} chunks verified)`);

  const browser = await chromium.launch();
  try {
    const state = await warmup(browser, base, token);
    const main = await record(browser, base, token, MAIN_SCENES, "main", state);
    if (main.length) {
      console.log("· normalising + assembling main cut");
      const clips: string[] = [];
      for (const [i, file] of main.entries()) {
        const out = path.join(RAW, `n-main-${String(i).padStart(2, "0")}.mp4`);
        await normalise(file, out, SCENE_SECONDS.get(file) ?? 0);
        clips.push(out);
      }
      await assemble(clips, path.join(OUT, "main.mp4"));
    }
    const teaser = await record(browser, base, token, TEASER_SCENES, "teaser", state);
    if (teaser.length) {
      console.log("· normalising + assembling teaser");
      const clips: string[] = [];
      for (const [i, file] of teaser.entries()) {
        const out = path.join(RAW, `n-teaser-${String(i).padStart(2, "0")}.mp4`);
        await normalise(file, out, SCENE_SECONDS.get(file) ?? 0);
        clips.push(out);
      }
      await assemble(clips, path.join(OUT, "teaser.mp4"));
    }
  } finally {
    await browser.close();
    if (!flag("keep")) {
      server?.kill("SIGTERM");
      server = undefined;
    } else {
      console.log(`· server left up on ${base} (PID ${server?.pid})`);
    }
  }
  for (const name of ["main", "teaser"]) {
    const file = path.join(OUT, `${name}.mp4`);
    const probe = await capture("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate,codec_name", "-show_entries", "format=duration", "-of", "json", file]);
    const meta = JSON.parse(probe) as { streams: { width: number; height: number; codec_name: string; r_frame_rate: string }[]; format: { duration: string } };
    const { width, height, codec_name } = meta.streams[0];
    const seconds = Number(meta.format.duration);
    const black = await capture("ffmpeg", ["-hide_banner", "-i", file, "-vf", "blackdetect=d=0.35:pic_th=0.98", "-f", "null", "-"]).catch(() => "");
    const gaps = (black.match(/black_start/g) ?? []).length;
    const ok = width === REC.width && height === REC.height && codec_name === "h264" && gaps <= 2;
    console.log(`  ${ok ? "✓" : "✗"} ${name}.mp4 ${width}x${height} ${codec_name} ${seconds.toFixed(1)}s, black spans: ${gaps}`);
  }
  // One contact sheet per cut so the whole story is reviewable at a glance.
  for (const name of ["main", "teaser"]) {
    await run("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(OUT, `${name}.mp4`), "-vf", "fps=1/6,scale=270:480,tile=4x3", "-frames:v", "1", path.join(OUT, `storyboard-${name}.png`)], { quiet: true }).catch(() => {});
  }
  await verifyContrast();
  await fs.writeFile(path.join(QA, "report.json"), JSON.stringify(QA_LOG, null, 1));
  const bad = QA_LOG.filter((e) => e.clipped || !e.visible || (e.overlaps.length > 0 && !e.overlayBeat));
  const fonts = [...new Set(QA_LOG.map((e) => e.fontFamily))];
  for (const e of bad) {
    console.log(`  ! ${e.scene}: clipped=${e.clipped} overlaps=${e.overlaps.join(",") || "none"} — "${e.caption}"`);
  }
  console.log(`  layout check: ${QA_LOG.length - bad.length}/${QA_LOG.length} caption beats clear · fonts: ${fonts.join(", ")}`);
  const realDbAfter = await hashOf(path.join(ROOT, "data/local.db"));
  if (realDbBefore !== realDbAfter) throw new Error("data/local.db changed — the video run must only touch data/video-demo.db");
  console.log(`  data/local.db untouched (${realDbAfter.slice(0, 12)})`);
  console.log(`done → ${path.relative(ROOT, OUT)}/  (QA stills in ${path.relative(ROOT, QA)}/)`);
}

process.on("SIGINT", () => {
  server?.kill("SIGTERM");
  process.exit(130);
});

main().catch((err) => {
  console.error(err);
  server?.kill("SIGTERM");
  process.exit(1);
});
