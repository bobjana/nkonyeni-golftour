// Portable DDL: only types and syntax that SQLite and Postgres both accept.
export const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    hidden_holes INTEGER NOT NULL DEFAULT 3,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id),
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    captain_id TEXT,
    sort INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id),
    team_id TEXT NOT NULL REFERENCES teams(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    handicap_index REAL NOT NULL DEFAULT 0,
    tee_id TEXT,
    is_organizer INTEGER NOT NULL DEFAULT 0,
    invite_token TEXT NOT NULL UNIQUE,
    invited_at TEXT,
    joined_at TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS players_event_email ON players(event_id, email)`,
  `CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id),
    name TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tees (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id),
    name TEXT NOT NULL,
    rating REAL NOT NULL,
    slope INTEGER NOT NULL,
    lengths TEXT NOT NULL DEFAULT '[]',
    is_default INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS holes (
    course_id TEXT NOT NULL REFERENCES courses(id),
    number INTEGER NOT NULL,
    par INTEGER NOT NULL,
    si INTEGER NOT NULL,
    PRIMARY KEY (course_id, number)
  )`,
  `CREATE TABLE IF NOT EXISTS days (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id),
    number INTEGER NOT NULL,
    date TEXT NOT NULL,
    course_id TEXT NOT NULL REFERENCES courses(id),
    revealed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    day_id TEXT NOT NULL REFERENCES days(id),
    slot TEXT NOT NULL,
    format TEXT NOT NULL,
    holes INTEGER NOT NULL DEFAULT 18,
    nine TEXT NOT NULL DEFAULT 'front',
    tee_time TEXT NOT NULL DEFAULT '07:30',
    pairing_deadline TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
  )`,
  `CREATE TABLE IF NOT EXISTS pairings (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    team_id TEXT NOT NULL REFERENCES teams(id),
    slot INTEGER NOT NULL,
    player1_id TEXT NOT NULL REFERENCES players(id),
    player2_id TEXT REFERENCES players(id),
    submitted_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pairings_slot ON pairings(session_id, team_id, slot)`,
  `CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    group_no INTEGER NOT NULL,
    match_no INTEGER NOT NULL,
    pairing_a_id TEXT NOT NULL REFERENCES pairings(id),
    pairing_b_id TEXT NOT NULL REFERENCES pairings(id),
    scorer_id TEXT REFERENCES players(id)
  )`,
  `CREATE TABLE IF NOT EXISTS scores (
    match_id TEXT NOT NULL REFERENCES matches(id),
    entity_id TEXT NOT NULL,
    hole INTEGER NOT NULL,
    strokes INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    PRIMARY KEY (match_id, entity_id, hole)
  )`,
  `CREATE TABLE IF NOT EXISTS score_log (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    hole INTEGER NOT NULL,
    strokes INTEGER,
    at TEXT NOT NULL,
    actor TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS score_checks (
    match_id TEXT NOT NULL REFERENCES matches(id),
    entity_id TEXT NOT NULL,
    hole INTEGER NOT NULL,
    strokes INTEGER NOT NULL,
    resolved_by TEXT NOT NULL,
    resolved_at TEXT NOT NULL,
    PRIMARY KEY (match_id, entity_id, hole)
  )`,
  `CREATE TABLE IF NOT EXISTS demo (
    event_id TEXT PRIMARY KEY REFERENCES events(id),
    plan TEXT NOT NULL,
    cursor INTEGER NOT NULL DEFAULT 0,
    clock REAL NOT NULL DEFAULT 0,
    running_since TEXT,
    speed REAL NOT NULL DEFAULT 1,
    started_at TEXT NOT NULL
  )`,
];
