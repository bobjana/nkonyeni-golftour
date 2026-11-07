import type { SqliteDatabase, SqliteStatement } from "kysely";

/**
 * Adapts Node's built-in `node:sqlite` to the better-sqlite3 shape Kysely's
 * SqliteDialect expects, so local dev needs no native module build.
 */
export async function openNodeSqlite(path: string): Promise<SqliteDatabase> {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  return {
    close: () => db.close(),
    prepare(sql: string): SqliteStatement {
      const stmt = db.prepare(sql);
      type P = Parameters<typeof stmt.all>;
      const args = (p: ReadonlyArray<unknown>) => p as unknown as P;
      return {
        reader: stmt.columns().length > 0,
        all: (p) => stmt.all(...args(p)),
        run: (p) => {
          const r = stmt.run(...args(p));
          return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
        },
        iterate: (p) => stmt.iterate(...args(p)) as IterableIterator<unknown>,
      };
    },
  };
}
