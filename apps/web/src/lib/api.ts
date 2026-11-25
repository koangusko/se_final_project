/**
 * 呼叫後端 API。路徑、參數、回傳型別都由後端 routes 推導，打錯會在編譯時報錯。
 *
 *   const { rooms } = await unwrap(api.space.rooms.$get());
 *   await unwrap(api.booking.bookings.$post({ json: input }));
 *
 * 失敗時 unwrap 會丟 ApiError（有 code 和中文 message），搭配 TanStack Query 使用。
 */
import { hc } from "hono/client";
import type { AppType } from "@class/api/app-type";
import type { ApiErrorBody, ErrorCode } from "@class/shared/errors";

export const api = hc<AppType>("/api");

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type JsonOf<R> = R extends { json(): Promise<infer J> } ? J : never;

interface ResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

function isApiErrorBody(v: unknown): v is ApiErrorBody {
  return typeof v === "object" && v !== null && "error" in v;
}

export async function unwrap<R extends ResponseLike>(p: Promise<R> | R): Promise<JsonOf<R>> {
  const res = await p;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiError(res.status, body.error.code, body.error.message, body.error.details);
    }
    throw new ApiError(res.status, "INTERNAL", `伺服器回應 ${res.status}`);
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 型別由 hono client 推導
  return body as JsonOf<R>;
}

/** 把任何錯誤轉成可以顯示給使用者的訊息 */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "發生未知錯誤";
}

/**
 * 上傳大檔案（3D 模型、全景圖），body 直接是檔案內容，可回報進度。
 * 後端用 core/media.ts 的 saveRequestBody 接收。
 */
export function uploadFile<T>(
  url: string,
  file: Blob,
  opts: { method?: "PUT" | "POST"; onProgress?: (ratio: number) => void } = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method ?? "PUT", url);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total);
    });
    xhr.addEventListener("error", () => reject(new ApiError(0, "INTERNAL", "網路錯誤，上傳失敗")));
    xhr.addEventListener("load", () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // 非 JSON 回應
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 呼叫端指定型別
        resolve(body as T);
      } else if (isApiErrorBody(body)) {
        reject(new ApiError(xhr.status, body.error.code, body.error.message, body.error.details));
      } else {
        reject(new ApiError(xhr.status, "INTERNAL", `上傳失敗（${xhr.status}）`));
      }
    });
    xhr.send(file);
  });
}
