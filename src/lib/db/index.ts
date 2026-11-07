import { Kysely, PostgresDialect, SqliteDialect, sql } from "kysely";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Database } from "./types";
import { DDL } from "./schema";
import { openNodeSqlite } from "./node-sqlite";

export type DB = Kysely<Database>;

const globalForDb = globalThis as unknown as { __db?: Promise<DB> };

/** True when DATABASE_URL points at Postgres (Neon in the cloud). */
export const isPostgres = () => /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");

async function create(): Promise<DB> {
  const url = process.env.DATABASE_URL ?? "file:./data/local.db";
  let db: DB;
  if (isPostgres()) {
    const { Pool } = await import("pg");
    db = new Kysely<Database>({
      dialect: new PostgresDialect({ pool: new Pool({ connectionString: url, max: 5 }) }),
    });
  } else {
    const path = url.replace(/^file:/, "");
    mkdirSync(dirname(path), { recursive: true });
    db = new Kysely<Database>({ dialect: new SqliteDialect({ database: () => openNodeSqlite(path) }) });
  }
  for (const stmt of DDL) await sql.raw(stmt).execute(db);
  return db;
}

export function getDb(): Promise<DB> {
  if (!globalForDb.__db) globalForDb.__db = create();
  return globalForDb.__db;
}
