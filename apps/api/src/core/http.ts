/**
 * 每個 route 都拿得到的共用物件：c.var.db、c.var.config、c.var.user。
 * 模組的 route 一律寫成 new Hono<AppEnv>()。
 */
import type { Role, UserStatus } from "@class/shared/permissions";
import type { Db } from "../db/client.ts";
import type { Config } from "../env.ts";
import type { LineClient } from "../auth/line.ts";

export interface CurrentUser {
  id: string;
  name: string | null;
  displayName: string;
  pictureUrl: string | null;
  role: Role;
  status: UserStatus;
  affiliation: string | null;
}

export interface AppEnv {
  Variables: {
    db: Db;
    config: Config;
    line: LineClient;
    /** 沒登入是 null */
    user: CurrentUser | null;
    sessionId: string | null;
  };
}
