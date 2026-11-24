/**
 * 環境變數。所有設定都從這裡讀，其他地方不要直接碰 process.env。
 * 本機開發不需要任何設定就能跑：沒有 DATABASE_URL 時自動用 PGlite（存在 apps/api/.data）。
 */
import path from "node:path";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_ORIGIN: z.url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1).optional(),
  PGLITE_DIR: z.string().default(".data/pglite"),
  MEDIA_DIR: z.string().default(".data/media"),
  /** 正式環境由後端提供前端靜態檔 */
  WEB_DIST_DIR: z.string().optional(),
  LINE_CHANNEL_ID: z.string().min(1).optional(),
  LINE_CHANNEL_SECRET: z.string().min(1).optional(),
  LINE_CALLBACK_URL: z.url().optional(),
  /** 開發用假登入。正式環境一律關閉，不管這裡設什麼 */
  DEV_LOGIN: z.enum(["0", "1"]).optional(),
});

export interface LineConfig {
  channelId: string;
  channelSecret: string;
  callbackUrl: string;
}

export interface Config {
  nodeEnv: "development" | "test" | "production";
  port: number;
  appOrigin: string;
  databaseUrl: string | null;
  pgliteDir: string;
  mediaDir: string;
  webDistDir: string | null;
  line: LineConfig | null;
  devLogin: boolean;
  /** 正式環境（https）才加 Secure 與 __Host- 前綴 */
  secureCookies: boolean;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const e = EnvSchema.parse(env);
  const isProd = e.NODE_ENV === "production";
  const line =
    e.LINE_CHANNEL_ID && e.LINE_CHANNEL_SECRET
      ? {
          channelId: e.LINE_CHANNEL_ID,
          channelSecret: e.LINE_CHANNEL_SECRET,
          callbackUrl: e.LINE_CALLBACK_URL ?? `${e.APP_ORIGIN}/api/auth/line/callback`,
        }
      : null;
  if (isProd && !e.DATABASE_URL) throw new Error("正式環境必須設定 DATABASE_URL");
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    appOrigin: e.APP_ORIGIN,
    databaseUrl: e.DATABASE_URL ?? null,
    pgliteDir: path.resolve(e.PGLITE_DIR),
    mediaDir: path.resolve(e.MEDIA_DIR),
    webDistDir: e.WEB_DIST_DIR ? path.resolve(e.WEB_DIST_DIR) : null,
    line,
    devLogin: !isProd && e.DEV_LOGIN !== "0",
    secureCookies: e.APP_ORIGIN.startsWith("https://"),
  };
}
