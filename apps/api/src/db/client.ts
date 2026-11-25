/**
 * 資料庫連線。
 * - 有 DATABASE_URL：連真的 PostgreSQL（正式環境、Docker）。
 * - 沒有：用 PGlite（WASM 版 Postgres），本機開發和測試不需要裝任何東西。
 * 兩者是同一套 SQL，migration 也共用 apps/api/drizzle/。
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Config } from "../env.ts";
import * as schema from "./schema/index.ts";

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

export interface DbHandle {
  db: Db;
  kind: "pg" | "pglite";
  migrate(): Promise<void>;
  close(): Promise<void>;
}

const migrationsFolder = path.resolve(import.meta.dirname, "../../drizzle");

export async function createDb(
  config: Pick<Config, "databaseUrl" | "pgliteDir">,
): Promise<DbHandle> {
  if (config.databaseUrl) return createPg(config.databaseUrl);
  return createPglite(config.pgliteDir);
}

async function createPg(url: string): Promise<DbHandle> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const pool = new Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool, { schema });
  return {
    // drizzle 對 pg 與 PGlite 回傳的型別參數不同，但查詢 API 完全一樣
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    db: db as unknown as Db,
    kind: "pg",
    migrate: () => migrate(db, { migrationsFolder }),
    close: () => pool.end(),
  };
}

/** dataDir 傳 null 表示純記憶體（測試用） */
export async function createPglite(dataDir: string | null): Promise<DbHandle> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  if (dataDir) await mkdir(path.dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir ?? "memory://", { extensions: { btree_gist } });
  const db = drizzle(client, { schema });
  return {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    db: db as unknown as Db,
    kind: "pglite",
    migrate: () => migrate(db, { migrationsFolder }),
    close: () => client.close(),
  };
}
