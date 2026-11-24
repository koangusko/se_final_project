/**
 * LINE Login v2.1（OpenID Connect，授權碼流程 + PKCE S256 + state + nonce）。
 * 文件：https://developers.line.biz/en/docs/line-login/integrate-line-login/
 *
 * ID token 不自己驗簽，交給 LINE 的 verify API（會檢查簽章、aud、exp、nonce）。
 * 測試時用 createApp({ line: 假的 LineClient }) 替換，不會真的連 LINE。
 */
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { LineConfig } from "../env.ts";
import { AppError } from "../core/errors.ts";

const AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export interface LineProfile {
  /** LINE user ID（同一個 provider 底下固定不變） */
  sub: string;
  name: string;
  picture: string | null;
}

export interface LineClient {
  readonly enabled: boolean;
  authorizeUrl(p: { state: string; nonce: string; codeChallenge: string }): string;
  exchangeCode(code: string, codeVerifier: string): Promise<{ idToken: string }>;
  verifyIdToken(idToken: string, nonce: string): Promise<LineProfile>;
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

const TokenResponse = z.object({ id_token: z.string() });
const VerifyResponse = z.object({
  sub: z.string(),
  name: z.string().default(""),
  picture: z.string().optional(),
});

const notConfigured = () => new AppError(503, "LINE_NOT_CONFIGURED", "伺服器尚未設定 LINE 登入");

export function createLineClient(
  config: LineConfig | null,
  fetchFn: typeof fetch = fetch,
): LineClient {
  if (!config) {
    return {
      enabled: false,
      authorizeUrl: () => {
        throw notConfigured();
      },
      exchangeCode: () => Promise.reject(notConfigured()),
      verifyIdToken: () => Promise.reject(notConfigured()),
    };
  }

  return {
    enabled: true,
    authorizeUrl({ state, nonce, codeChallenge }) {
      const url = new URL(AUTHORIZE_URL);
      url.search = new URLSearchParams({
        response_type: "code",
        client_id: config.channelId,
        redirect_uri: config.callbackUrl,
        state,
        scope: "openid profile",
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      }).toString();
      return url.toString();
    },

    async exchangeCode(code, codeVerifier) {
      const res = await fetchFn(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: config.callbackUrl,
          client_id: config.channelId,
          client_secret: config.channelSecret,
          code_verifier: codeVerifier,
        }),
      });
      if (!res.ok) throw new Error(`LINE token 交換失敗：HTTP ${res.status}`);
      const body = TokenResponse.parse(await res.json());
      return { idToken: body.id_token };
    },

    async verifyIdToken(idToken, nonce) {
      const res = await fetchFn(VERIFY_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ id_token: idToken, client_id: config.channelId, nonce }),
      });
      if (!res.ok) throw new Error(`LINE ID token 驗證失敗：HTTP ${res.status}`);
      const body = VerifyResponse.parse(await res.json());
      return { sub: body.sub, name: body.name, picture: body.picture ?? null };
    },
  };
}
