/**
 * API 測試工具。每個測試檔呼叫一次 createTestContext()，會得到一個全新的記憶體資料庫。
 *
 *   const t = await createTestContext();
 *   afterAll(() => t.close());
 *   const admin = await t.createUser({ role: "admin" });
 *   const res = await t.request("/api/space/rooms", { method: "POST", as: admin, json: {...} });
 *   expect(res.status).toBe(201);
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Role, UserStatus } from "@class/shared/permissions";
import { createApp } from "../src/app.ts";
import type { LineClient } from "../src/auth/line.ts";
import { createSession } from "../src/auth/session.ts";
import { createPglite } from "../src/db/client.ts";
import { users } from "../src/db/schema/index.ts";
import { loadConfig, type Config } from "../src/env.ts";

export interface TestUser {
  id: string;
  name: string;
  role: Role;
  status: UserStatus;
  cookie: string;
}

export interface RequestOptions {
  method?: string;
  /** 以這個使用者身分送出（帶 session cookie） */
  as?: TestUser;
  json?: unknown;
  body?: RequestInit["body"];
  headers?: Record<string, string>;
}

let seq = 0;

export async function createTestContext(
  opts: { line?: LineClient; config?: Partial<Config> } = {},
) {
  const mediaDir = await mkdtemp(path.join(tmpdir(), "class-media-"));
  const handle = await createPglite(null);
  await handle.migrate();
  const config: Config = {
    ...loadConfig({ NODE_ENV: "test", APP_ORIGIN: "http://localhost:5173" }),
    mediaDir,
    ...opts.config,
  };
  const app = createApp({ db: handle.db, config, ...(opts.line ? { line: opts.line } : {}) });
  const db = handle.db;

  /** 直接在資料庫建一個使用者並登入，預設是已核准的一般使用者 */
  async function createUser(
    u: { role?: Role; status?: UserStatus; name?: string } = {},
  ): Promise<TestUser> {
    seq += 1;
    const name = u.name ?? `測試者${seq}`;
    const [row] = await db
      .insert(users)
      .values({
        lineUserId: `test-${seq}-${Math.random().toString(36).slice(2)}`,
        lineDisplayName: name,
        name,
        affiliation: "測試",
        role: u.role ?? "user",
        status: u.status ?? "approved",
      })
      .returning();
    if (!row) throw new Error("createUser failed");
    const s = await createSession(db, row.id);
    return { id: row.id, name, role: row.role, status: row.status, cookie: `session=${s.token}` };
  }

  function request(url: string, o: RequestOptions = {}) {
    const headers: Record<string, string> = { "sec-fetch-site": "same-origin", ...o.headers };
    if (o.as) headers.cookie = o.as.cookie;
    let body = o.body;
    if (o.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(o.json);
    }
    return app.request(url, { method: o.method ?? (body ? "POST" : "GET"), headers, body });
  }

  async function close() {
    await handle.close();
    await rm(mediaDir, { recursive: true, force: true });
  }

  return { app, db, config, request, createUser, close };
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;
