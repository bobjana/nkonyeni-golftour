# nkonyeni-golftour — MVP spec (draft for sign-off)

Mobile-first PWA for Ryder Cup–style golf tours. Organizers set everything up, one scorer per group captures scores, and everyone follows a live team tally.

## 1. Interview decisions

| Topic | Decision |
|---|---|
| Scoring | **Points per hole**: the team whose side wins a hole gets 1 pt, a halved hole gives ½ each. Every hole is played; matches never end early. Points add up across the whole tour. |
| Formats (MVP) | Better ball (4BBB), Foursomes (alternate shot), **Singles** (1 v 1, Day 3 "ips") |
| Handicaps | Organizer enters each player's **Handicap Index**. Course handicap = HI × Slope/113 + (CR − Par). WHS allowances: Better ball 90% · Singles 100% · Foursomes 50% of the pair's combined handicap. Strokes are given off the lowest in the match and allocated by stroke index. |
| 9-hole sessions | Organizer picks front 9 or back 9 per session. The 18-hole allowance is halved (rounded) and allocated by SI order within that nine. |
| Hidden holes | The last **N holes of every session** are hidden (default 3, configurable per event). Scorers see their own group. Everyone else sees 🔒 on those holes. |
| Reveal | At the end of each day the **organizer** reveals all of that day's hidden holes at once, with an animated reveal. |
| Pairings | **Team captains** submit their pairings blind per session before a deadline. The organizer matches them up, picks a scorer per group and publishes. |
| Roles | Player · Captain · Scorer (per session) · Organizer. Any player can also be an organizer. |
| Registration | Email invite link sent via **Resend** → player opens the app → enters the shared event password → logged in on that device (long-lived session). |
| Offline | **Offline-first PWA**: scores save on the phone immediately and sync when there's signal. Conflicts resolve as latest-write-wins per hole, with an audit log. |
| Stack | Next.js (App Router, TypeScript) · Tailwind · Drizzle ORM · SQLite locally / Neon Postgres in cloud · Docker → GCP Cloud Run |
| Look | Classic Ryder Cup: navy and gold, plus team colours (Medics red, Business-Elites blue) |

## 2. Points per hole: how the tally works

- **Better ball**: each side's best net score on the hole is compared. Lower wins the hole → 1 pt to that team.
- **Foursomes**: one ball per pair. The pair's net score is compared.
- **Singles**: net vs net.
- Live tally per match: "Medics 6½ – 4½ Business-Elites thru 11", plus a hole-by-hole strip.
- Team tally = sum of all match points for the session, day and tour.

Points available in the sample config (2 matches per pairs session, 4 singles matches):

| Day | Session | Format | Holes | Matches | Points |
|---|---|---|---|---|---|
| 1 | PM | Better ball | 18 | 2 | 36 |
| 2 | AM | Better ball | 18 | 2 | 36 |
| 2 | PM | Foursomes | 9 | 2 | 18 |
| 3 | AM | Singles | 18 | 4 | 72 |
| 3 | PM | Foursomes | 9 | 2 | 18 |
| | | | | **Total** | **180** (win > 90) |

> ⚠️ Because points are per hole, Day 3 singles carry 40% of the total points. Flag this if you'd prefer a weighting.

## 3. Screens

**Player**
1. Login: invite link landing + event password
2. Home (live): team tally, live matches, 🔒 hidden holes
3. Home (between sessions): previous-day summary and overall standings
4. Match detail: hole-by-hole with net/gross and strokes received

**Scorer** (opens the scorecard by default while their session is live)
5. Scorecard: Better ball (4 players, best ball per side highlighted)
6. Scorecard: Foursomes (1 score per pair)
7. Scorecard: Singles (2 matches in one group)

**Captain**
8. Submit pairings (blind) for the next session

**Organizer**
9. Event: create event, days, sessions (format, holes, front/back, time)
10. Teams & players: team names/colours, captain, players, HI, tee, invites
11. Course: holes, par, SI, tees with rating/slope
12. Session setup: match up the captains' pairings, assign scorers, publish
13. Grand reveal: reveal the day's hidden holes

## 4. Data model (summary)

Event(id, name, password_hash, hidden_holes=3) · Team(id, event, name, colour, captain_player) · Player(id, event, team, name, email, handicap_index, tee, is_organizer) · Course(id, name) · Tee(id, course, name, rating, slope) · Hole(course, number, par, si) · Day(id, event, date, course) · Session(id, day, slot AM/PM, format, holes 9/18, nine front/back, pairing_deadline, status draft/pairing/live/complete, revealed) · Pairing(session, team, slot, player_ids) · Group(session, scorer_player) · Match(id, session, group, side_a_pairing, side_b_pairing) · Score(match, player_or_pair, hole, strokes, updated_at, updated_by) · Reveal(day, revealed_at)

## 5. Sample seed

- Event: Nkonyeni Golf Tour 2026 · password from `.env.local`
- Teams: **Medics** (red) and **Business-Elites** (blue), 4 players each (placeholder names, HI to be supplied)
- Course: **Royal Swazi Spa**, par 72, from the published scorecard (golfingrecord.com, cross-checked with golfpass.com):

| Hole | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Par | 4 | 4 | 3 | 4 | 5 | 3 | 5 | 4 | 4 | 4 | 4 | 5 | 4 | 3 | 4 | 4 | 5 | 3 |
| SI | 18 | 4 | 8 | 6 | 10 | 14 | 2 | 16 | 12 | 9 | 1 | 17 | 7 | 15 | 5 | 11 | 3 | 13 |

Tees: White 6715 m (CR 72.5 / Slope 137) · Blue 6136 m (69.5 / 131) · Red 5504 m (66.4 / 121). The published card doesn't say which tees are men's or ladies' ratings. Default tee = **Blue** (please confirm).

- Day 1 PM: Better ball, 18 · Day 2 AM: Better ball, 18 / PM: Foursomes, 9 · Day 3 AM: Singles, 18 / PM: Foursomes, 9

## 6. Open items to confirm at mockup sign-off

1. Default tee (Blue?) and whether ladies play.
2. Singles weighting (see ⚠️ above).
3. Pairing deadline default (e.g. 1 h before tee-off). If a captain misses the deadline, the organizer sets the pairings.
4. Resend sender domain (e.g. `golftour@yourdomain`).
