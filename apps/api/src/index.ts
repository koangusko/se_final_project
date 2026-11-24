/** 伺服器進入點：讀設定 -> 連資料庫 -> 跑 migration -> 開 port。 */
import { mkdir } from "node:fs/promises";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { createDb } from "./db/client.ts";
import { loadConfig } from "./env.ts";

const config = loadConfig();
await mkdir(config.mediaDir, { recursive: true });
const handle = await createDb(config);
await handle.migrate();

const app = createApp({ db: handle.db, config });
const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(
    `api listening on http://localhost:${info.port} (db: ${handle.kind}, line: ${config.line ? "on" : "off"}, dev-login: ${config.devLogin ? "on" : "off"})`,
  );
});

const shutdown = () => {
  server.close();
  void handle.close().finally(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
