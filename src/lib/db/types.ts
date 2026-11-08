// Row shapes shared by SQLite (local) and Postgres (Neon). Booleans are 0/1
// integers and timestamps are ISO strings so one schema works on both.

export type Format = "better_ball" | "foursomes" | "singles";
export type SessionStatus = "draft" | "pairing" | "live" | "complete";

export interface EventRow {
  id: string;
  name: string;
  password_hash: string;
  hidden_holes: number;
  created_at: string;
}

export interface TeamRow {
  id: string;
  event_id: string;
  name: string;
  color: string;
  captain_id: string | null;
  sort: number;
}

export interface PlayerRow {
  id: string;
  event_id: string;
  team_id: string;
  name: string;
  email: string;
  handicap_index: number;
  tee_id: string | null;
  is_organizer: number;
  invite_token: string;
  invited_at: string | null;
  joined_at: string | null;
}

export interface CourseRow {
  id: string;
  event_id: string;
  name: string;
}

export interface TeeRow {
  id: string;
  course_id: string;
  name: string;
  rating: number;
  slope: number;
  /** JSON array of 18 hole lengths in metres */
  lengths: string;
  is_default: number;
}

export interface HoleRow {
  course_id: string;
  number: number;
  par: number;
  si: number;
}

export interface DayRow {
  id: string;
  event_id: string;
  number: number;
  date: string;
  course_id: string;
  revealed_at: string | null;
}

export interface SessionRow {
  id: string;
  day_id: string;
  slot: "AM" | "PM";
  format: Format;
  holes: number;
  nine: "front" | "back";
  tee_time: string;
  pairing_deadline: string | null;
  status: SessionStatus;
}

export interface PairingRow {
  id: string;
  session_id: string;
  team_id: string;
  slot: number;
  player1_id: string;
  player2_id: string | null;
  submitted_at: string;
}

export interface MatchRow {
  id: string;
  session_id: string;
  group_no: number;
  match_no: number;
  pairing_a_id: string;
  pairing_b_id: string;
  scorer_id: string | null;
}

export interface ScoreRow {
  match_id: string;
  /** player id (better ball, singles) or pairing id (foursomes) */
  entity_id: string;
  hole: number;
  /** gross strokes; 0 = picked up */
  strokes: number;
  updated_at: string;
  updated_by: string;
}

export interface ScoreLogRow {
  id: string;
  match_id: string;
  entity_id: string;
  hole: number;
  strokes: number | null;
  at: string;
  actor: string;
}

/** The organizer's ruling on a hole where group members entered different scores. */
export interface ScoreCheckRow {
  match_id: string;
  entity_id: string;
  hole: number;
  strokes: number;
  resolved_by: string;
  resolved_at: string;
}

/** The in-app demo: a timeline of actions replayed against the event as time passes. */
export interface DemoRow {
  event_id: string;
  /** JSON DemoPlan (see lib/demo-plan.ts) */
  plan: string;
  /** index of the next action to apply */
  cursor: number;
  /** demo seconds banked before running_since (the whole clock while paused) */
  clock: number;
  running_since: string | null;
  speed: number;
  started_at: string;
}

export interface Database {
  events: EventRow;
  teams: TeamRow;
  players: PlayerRow;
  courses: CourseRow;
  tees: TeeRow;
  holes: HoleRow;
  days: DayRow;
  sessions: SessionRow;
  pairings: PairingRow;
  matches: MatchRow;
  scores: ScoreRow;
  score_log: ScoreLogRow;
  score_checks: ScoreCheckRow;
  demo: DemoRow;
}
