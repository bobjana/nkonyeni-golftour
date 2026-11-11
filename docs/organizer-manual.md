# Organizer manual — Nkonyeni Golf Tour 2026

This manual is for the event organizer and is based on the **current schedule** in the app (the seeded event — `npm run seed -- --demo` / `--reset`). If you change days, sessions, tee times or players in **Organize → Event / Teams**, update the tables below to match.

**Quick links:** the app runs at the URL you deployed to. Install it on phones (Add to Home Screen) so scorers can keep cards offline.

**In-app checklist:** Organize → **Checklist** shows the same per-day steps with their times — items strike through once their time passes, and the ones still ahead can be ticked (ticks are saved on that device).

---

## 1. Quick reference

| | |
|---|---|
| Event | Nkonyeni Golf Tour 2026 |
| Teams | **Business Elite** (blue) — Jan Viljoen (captain & organizer), Vernon, Johny, Owen |
| | **Challenge** (red) — Gerald (captain), Ras, JP, Deodat |
| Event password | `tour2026` (change it in Organize → Event; communicate it to players) |
| Hidden holes | Last **3** holes of the day's **final session** only (event setting, Organize → Event) |
| Scoring | Hole won = 1 pt, halved = ½ each. WHS allowances: better ball 90%, foursomes 50% (combined), singles 100%. Strokes off the lowest in each match, by stroke index. |
| Win condition | **First to 90.5 points wins the tour** (180 pts available). |

### Schedule

| Day | Date | Course | Session | Format | Holes | Tee-off | Points |
|---|---|---|---|---|---|---|---|
| 1 | Fri 13 Nov | Royal Swazi Spa | PM | Better ball | 18 (front) | 12:30 | 36 |
| 2 | Sat 14 Nov | Nkonyeni | AM | Better ball | 18 (front) | 07:30 | 36 |
| 2 | Sat 14 Nov | Nkonyeni | PM | Foursomes | 9 (front) | 13:00 | 18 |
| 3 | Sun 15 Nov | Nkonyeni | AM | Singles | 18 (front) | 07:30 | 72 |
| 3 | Sun 15 Nov | Nkonyeni | PM | Foursomes | 9 (back) | 13:00 | 18 |
| | | | | | | **Total** | **180** |

Hidden holes per day: **Day 1** 16–18 · **Day 2 PM** 7–9 · **Day 3 PM** 16–18. Everything else is visible live.

### Signing in

- Each player has a **unique invite link** (Organize → Teams → player → copy the invite URL). Send it by WhatsApp — the first tap **signs them in automatically**, no password needed.
- Anyone with the invite link gets that player's access: don't forward links to the wrong person. Players can also sign in on the login page with their email + event password.
- There is **no in-app way to rotate a link** for a player who already exists. If a link leaks: remove the player and re-add them (only possible before they're in a draw) so a fresh token is issued, or use the login page instead of links for that player.

---

## 2. Before the tour — one-time setup

- [ ] **Teams & players** (Organize → Teams): names, emails, **handicap indexes** (HI drives every stroke), tee (leave "Course default" unless someone plays a different tee), captain per team, and who has organizer access.
- [ ] **Invites**: send each player their invite link and confirm "Joined" appears on Teams.
- [ ] **Event** (Organize → Event): name, password, **hidden last holes = 3**.
- [ ] **Courses** (Organize → Courses): par, SI, tees with rating/slope, default tee.
- [ ] **Dry run** with Organize → Demo (see §5). Note: starting a demo **wipes every pairing, score and reveal** — never start one on a real tour day.
- [ ] **Deploy**: `APP_URL` must be the public URL (otherwise invite links point at localhost), and set `--min-instances 1` on the tour days for instant loads.
- [ ] On real tour days set `DEMO_DISABLED=1` so the Demo tab disappears and nobody can wipe live scores by accident.

---

## 3. How a session runs (the daily loop)

1. **Open pairings** — Organize → Event → tap the session → **Open pairings to captains**. Captains see a banner and submit their pairs (or singles order) **blind**. The pill on the Event tab shows `Pairings 1/2 → 2/2`.
   - Set **Pairings due** on the session to show captains a deadline — it is displayed but **not enforced**, so chase both captains.
   - You can also set a team's pairings yourself (Set pairings link on the session page).
2. **Publish the draw** — once both teams are in, set the **match-ups** (and swap if you want different opponents) and pick the **scorer per group**, then **Publish draw & go live**.
   - Anyone in a group may keep the card; the scorer gets the scorecard automatically when they open the app.
3. **Play** — scorers tap holes as they finish. Scores save on the phone first and sync when there's signal. The **session completes itself** when every hole of every match is in (the live pages stop listing it as live).
   - If the last card is slow, you can **Mark complete** (and **Reopen scoring** if a card was wrong).
   - **Reset draw** is only possible before any scores exist — it returns the session to pairing.
4. **End of the day** — Organize → **Approve**: settle any score checks, then **Reveal to everyone** (§4).

---

## 4. Score checks and the Grand Reveal (Approve tab)

- A **score check** appears when two phones in the same group entered **different strokes** for the same player on the same hole. The live tally uses the latest entry ("counting now") until you rule.
- On **Organize → Approve** each conflict lists who entered what, and when. **Tap the correct score** to settle it — the ruling is written to the card and logged.
- A ruling stays until someone enters a different value afterwards, which re-opens the check.
- Resolve **all** checks before the reveal. The reveal button works even with open checks, but then a wrong score can be revealed to everyone.
- **Reveal to everyone** unlocks the day's hidden holes and every phone plays the drumroll once, then shows the day's result and the new standings. Reveal only after the day's **last** session — the hidden holes belong to that session.
- **Hide again** lets you roll a reveal back (e.g. you revealed too early).

---

## 5. Demo mode (practice only)

- Organize → **Demo** replays the whole tour on a fast clock (~30 min at 1×): pairings open, captains submit, draws go live, groups score hole by hole, holes go dark, and every day ends in a Grand Reveal.
- Controls: Pause/Resume, speed ½×–4×, **Skip to next** (jumps to the next highlight), **Stop demo**.
- There is **no background worker**: phones advance the demo (a tick every ~3 s), so it only moves while someone has the app open.
- **Starting a demo wipes every pairing, score and reveal.** Players, teams and courses stay. Set `DEMO_DISABLED=1` on real days.

---

## 6. Day-by-day checklist

### Day 1 — Friday 13 November · Royal Swazi Spa · PM better ball (36 pts)

- [ ] **Morning (before 10:00)** — Open pairings for Day 1 PM; set due 11:30; WhatsApp both captains.
- [ ] **11:30** — Confirm `Pairings 2/2` on the Event tab. Set match-ups & scorers → **Publish draw & go live**.
- [ ] **12:15** — On course: each scorer's phone opens the card; everyone else sees the Live tally.
- [ ] **12:30** — Tee-off. Live scoring; last 3 holes (16–18) show 🔒 until the reveal.
- [ ] **During** — Watch the Live tab; if "scores to check" appears, open **Approve** and settle them.
- [ ] **After the last group** — Session auto-completes; verify status is **Complete**.
- [ ] **Approve → Reveal to everyone** — phones drumroll; Day 1 result + standings.
- [ ] **Evening** — Announce the result; no pairings to open yet (Day 2 AM is tomorrow morning).

### Day 2 — Saturday 14 November · Nkonyeni · AM better ball (36) + PM foursomes (18)

- [ ] **Evening before / early morning** — Open Day 2 AM pairings; due 06:30; chase captains.
- [ ] **06:30** — Publish AM draw (2 matches, better ball); scorers know their groups.
- [ ] **07:30** — AM tee-off. AM is **fully visible** (no hidden holes).
- [ ] **~11:30** — AM complete → **Approve**: resolve any checks. **Do not reveal yet** (PM still to come).
- [ ] **11:30–12:00** — Open Day 2 PM pairings (foursomes); due 12:00.
- [ ] **12:45** — Publish PM draw; confirm scorers.
- [ ] **13:00** — PM tee-off, 9 holes (front); holes **7–9 hidden** until the reveal.
- [ ] **After PM complete** — **Approve**: resolve checks → **Reveal to everyone** → Day 2 result + standings.

### Day 3 — Sunday 15 November · Nkonyeni · AM singles (72 pts — the big one) + PM foursomes (18)

- [ ] **Evening before** — Open Day 3 AM **singles** pairings; due 06:30. Singles carries 40% of all points — no mistakes.
- [ ] **06:30** — Publish AM draw: **4 singles matches** in 2 groups; pick a scorer per group.
- [ ] **07:30** — AM tee-off, fully visible.
- [ ] **After AM complete** — **Approve**: resolve checks; no reveal yet.
- [ ] **12:00** — Open Day 3 PM pairings (foursomes); due 12:00.
- [ ] **12:45** — Publish PM draw; confirm scorers.
- [ ] **13:00** — PM tee-off, 9 holes (back); holes **16–18 hidden**.
- [ ] **After PM complete** — **Approve**: resolve checks → **Reveal to everyone**.
- [ ] **Final** — First to 90.5 takes the tour; the standings show the winner. Announce and close.

---

## 7. Troubleshooting

| Problem | What to do |
|---|---|
| Player taps invite link but it opens localhost | `APP_URL` isn't set to the public URL (deploy.env). Fix and re-send links. |
| Player not signed in after tapping the link | Re-send the exact link from Teams; the link signs them in once. They can also use email + event password on the login page. |
| Scores not appearing on a phone | The phone is offline — scores are queued in that browser's local storage and sync automatically when back online. Don't clear browser data. |
| "Signed out. Sign in again to sync your scores." (401) | The session expired (90 days) or cookie cleared. Sign in again on the same phone — the queued scores still sync. |
| "You're not in this match's group." (403) | That phone isn't the scorer or a player in the group. The server rejects those entries, but the phone keeps them queued and retries — it won't corrupt any other card. Keep the card on a phone that belongs to the group. |
| Two phones disagree on a hole | That's a score check — Approve tab, tap the correct score. The card uses "counting now" until you rule. |
| Session stuck on Live | All holes may not be in (a pick-up/blank cell). Check the session page `n/m` counts, or **Mark complete** / **Reopen scoring**. |
| Hidden holes still locked after reveal | The reveal is per **day** (Approve tab). Revealing happens after the day's final session. |
| Captains haven't submitted | Pairing deadline is only informational — chase them on WhatsApp; you can also set their pairings yourself. |
| You want to redo a draw | **Reset draw** works only before any scores exist (returns to pairing). After that, resolve with rulings instead. |
| Demo tab missing on a real day | Good — `DEMO_DISABLED=1`. If present, never press Start (it wipes pairings, scores and reveals). |
