/**
 * 組裝 Hono app。測試用 createApp({ db, config, line }) 建一個獨立的 app，不需要開 port。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { ApiErrorBody } from "@class/shared/errors";
import { createLineClient, type LineClient } from "./auth/line.ts";
import { csrfMiddleware, sessionMiddleware } from "./auth/middleware.ts";
import { AppError } from "./core/errors.ts";
import type { AppEnv } from "./core/http.ts";
import type { Db } from "./db/client.ts";
import type { Config } from "./env.ts";
import { apiRoutes } from "./routes.ts";

// 沒有自訂訊息的驗證錯誤也用繁體中文（例如「無效的 UUID」）
z.config(z.locales.zhTW());

export interface AppDeps {
  db: Db;
  config: Config;
  line?: LineClient;
}

export function createApp(deps: AppDeps) {
  const line = deps.line ?? createLineClient(deps.config.line);
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    c.set("db", deps.db);
    c.set("config", deps.config);
    c.set("line", line);
    await next();
  });

  app.use(
    "*",
    secureHeaders({
      // 3D 檢視器需要 WebGL / blob worker；先不設 CSP，之後再收緊
      contentSecurityPolicy: undefined,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use("/api/*", csrfMiddleware, sessionMiddleware);
  app.route("/api", apiRoutes);
  app.all("/api/*", (c) => {
    const body: ApiErrorBody = { error: { code: "NOT_FOUND", message: "找不到這個 API" } };
    return c.json(body, 404);
  });

  app.use(
    "/media/*",
    serveStatic({
      root: deps.config.mediaDir,
      rewriteRequestPath: (p) => p.replace(/^\/media/, ""),
    }),
  );

  const webDist = deps.config.webDistDir;
  if (webDist) {
    app.use("/assets/*", async (c, next) => {
      await next();
      if (c.res.ok) c.header("cache-control", "public, max-age=31536000, immutable");
    });
    app.use("*", serveStatic({ root: webDist }));
    // SPA：其他 GET 都回 index.html，交給前端路由
    let indexHtml: string | null = null;
    app.get("*", async (c) => {
      indexHtml ??= await readFile(path.join(webDist, "index.html"), "utf8");
      return c.html(indexHtml);
    });
  }

  app.onError((err, c) => {
    if (err instanceof AppError) {
      const body: ApiErrorBody = {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details === undefined ? {} : { details: err.details }),
        },
      };
      return c.json(body, err.status);
    }
    if (err instanceof HTTPException) {
      const body: ApiErrorBody = { error: { code: "INTERNAL", message: err.message } };
      return c.json(body, err.status);
    }
    console.error(err);
    const body: ApiErrorBody = { error: { code: "INTERNAL", message: "伺服器發生錯誤" } };
    return c.json(body, 500);
  });

  return app;
}
