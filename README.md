# nkonyeni-golftour

Mobile-first web app (installable PWA) for Ryder Cup–style golf tours. Organizers set up the event, teams, courses and sessions. Captains submit pairings blind, one scorer per group keeps the card (offline-friendly), and everyone follows a live team tally. The last N holes of every session stay hidden until the organizer's Grand Reveal.

**Scoring:** points per hole (win = 1, halve = ½ each) in better ball, foursomes and singles, with WHS handicap allowances (90% / 50% combined / 100%). See [SPEC.md](SPEC.md) for the full rules.

## Stack

- Next.js 15 (App Router, server actions) + Tailwind CSS 4
- Kysely query builder: **SQLite** locally via Node's built-in `node:sqlite` (no native build), **Postgres / Neon** in the cloud. The same portable schema is applied automatically on start-up.
- Resend for invite emails · Docker → Google Cloud Run

## Run locally

Requires Node 22.13+ (Node 24/26 recommended).

```bash
npm install
npm run seed -- --demo     # sample tour; --demo also plays Day 1 and half of Day 2 AM
npm run dev
```

Open http://localhost:3000 and sign in as `organizer@example.com` with event password `tour2026`. Every other seeded player is `<firstname>@example.com`, e.g. `ruan@example.com`.

- `npm run seed -- --reset` wipes the local DB and seeds a clean tour (no scores).
- `npm test` runs the scoring-engine unit tests.
- Without `RESEND_API_KEY`, invite links are printed to the server log and shown on **Organize → Teams** (expand a player).

## Sample tour (seeded)

| Day | Session | Format | Holes |
|---|---|---|---|
| 1 | PM | Better ball | 18 @ Royal Swazi Spa |
| 2 | AM | Better ball | 18 |
| 2 | PM | Foursomes | 9 (front) |
| 3 | AM | Singles | 18 |
| 3 | PM | Foursomes | 9 (back) |

Teams: Medics and Business-Elites, 4 placeholder players each; the first player of each team is captain. Royal Swazi Spa par/SI and White/Blue/Red tee ratings come from the published scorecard, with Blue as the default tee. Edit names, emails and handicaps on **Organize → Teams**.

## How a session runs

1. **Organize → Event → session → "Open pairings to captains"**. Captains see a banner and submit pairs (or singles order) blind. The organizer can also set pairings for either team.
2. When both teams are in, set the match-ups and the scorer per group, then **Publish draw & go live**.
3. Scorers who open the app land straight on their scorecard. Scores save on the phone first and sync when there's signal. The session completes itself when every hole is in.
4. At the end of the day: **Organize → Reveal → Reveal to everyone**. Each phone plays the drumroll once and shows the day's result.

## Demo mode

**Organize → Demo** plays the whole tour on a fast clock (about 26 minutes at 1×, 6½ at 4×): pairings open, captains submit, the draw goes live, each group's scorer enters hole by hole, the hidden holes go dark and every day ends in the Grand Reveal. Anyone signed in sees it on their own phone; a gold strip at the top shows a demo is on. Pause, change speed, or **Skip to next** jumps to the next highlight (draw, hidden holes, last putt, reveal).

- **Enter scores yourself:** press Pause, open any group from **Enter scores yourself** on the Demo tab (or sign in as a player in that group) and save holes. Press Resume and the simulator carries on from the next hole nobody has entered. If you save while it runs, it leaves that group to you until you next press Resume.
- Starting a demo wipes the event's pairings, scores and reveals. Players, teams and courses stay.
- There's no background worker: open phones advance the demo every 3 s, so it pauses while nobody has the app open and catches up when someone returns.
- Set `DEMO_DISABLED=1` on the real tour days to hide the Demo tab so nobody wipes live scores.

## Deploy: Neon + Cloud Run

1. **Neon:** create a project and database, then copy the pooled connection string (`postgresql://…?sslmode=require`).
2. **Seed Neon** from your machine (creates tables and the sample tour):
   ```bash
   DATABASE_URL="postgresql://…" SEED_EVENT_PASSWORD="<event password>" SEED_ORGANIZER_EMAIL="you@yourdomain.com" npm run seed
   ```
3. **Secrets** (once):
   ```bash
   printf '%s' "postgresql://…" | gcloud secrets create golftour-db --data-file=-
   openssl rand -base64 32 | tr -d '\n' | gcloud secrets create golftour-session --data-file=-
   printf '%s' "re_…" | gcloud secrets create golftour-resend --data-file=-
   ```
   Grant the Cloud Run runtime service account `roles/secretmanager.secretAccessor` on them.
4. **Deploy** (builds the Dockerfile with Cloud Build):
   ```bash
   gcloud run deploy nkonyeni-golftour --source . --region africa-south1 --allow-unauthenticated \
     --set-secrets DATABASE_URL=golftour-db:latest,SESSION_SECRET=golftour-session:latest,RESEND_API_KEY=golftour-resend:latest \
     --set-env-vars "EMAIL_FROM=Nkonyeni Golf Tour <golftour@yourdomain.com>,APP_URL=https://<your-service-url>"
   ```
   Re-run with the real `APP_URL` once you know the service URL (or map a custom domain).
5. In Resend, verify the sending domain used in `EMAIL_FROM`.

Cloud Run scales to zero between tours. Set `--min-instances 1` during the tour days for instant loads on the course.
