/**
 * 媒體檔（全景圖、3D 模型、照片、平面圖）存放。
 * 檔案放在 MEDIA_DIR 底下，網址是 /media/<相對路徑>，由 app.ts 直接提供靜態檔。
 * 資料庫只存相對路徑，不存完整網址。
 *
 * 上傳方式：前端用 fetch PUT/POST，body 直接放檔案（不是 multipart），
 * 後端用 saveRequestBody 串流寫入硬碟，不會整個檔案讀進記憶體。
 */
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { AppError, validationError } from "./errors.ts";

const SAFE_REL_PATH = /^[a-z0-9][a-z0-9/_-]*\.[a-z0-9]{2,5}$/i;

function resolveSafe(mediaDir: string, relPath: string): string {
  if (!SAFE_REL_PATH.test(relPath) || relPath.includes("..")) {
    throw new Error(`unsafe media path: ${relPath}`);
  }
  return path.join(mediaDir, relPath);
}

export const mediaUrl = (relPath: string) => `/media/${relPath}`;

/**
 * 把請求 body 串流寫到 MEDIA_DIR/relPath。超過 maxBytes 回 413，並刪掉寫到一半的檔案。
 * 回傳實際寫入的位元組數。
 */
export async function saveRequestBody(
  mediaDir: string,
  relPath: string,
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<number> {
  if (!body) throw validationError("沒有收到檔案內容");
  const full = resolveSafe(mediaDir, relPath);
  await mkdir(path.dirname(full), { recursive: true });

  let written = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      written += chunk.length;
      if (written > maxBytes) {
        cb(
          new AppError(
            413,
            "PAYLOAD_TOO_LARGE",
            `檔案超過上限 ${Math.round(maxBytes / 1024 / 1024)} MB`,
          ),
        );
        return;
      }
      cb(null, chunk);
    },
  });

  try {
    // 前端的 tsc（lib: dom）經由 app-type 也會檢查到這個檔案，DOM 與 Node 的 ReadableStream 型別不相容
    // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- 後端 tsc 下是同一型別，前端 tsc 下不是
    const nodeBody = body as NodeReadableStream<Uint8Array>;
    await pipeline(Readable.fromWeb(nodeBody), limiter, createWriteStream(full));
  } catch (err) {
    await rm(full, { force: true });
    throw err;
  }
  if (written === 0) {
    await rm(full, { force: true });
    throw validationError("檔案是空的");
  }
  return written;
}

export async function deleteMedia(mediaDir: string, relPath: string): Promise<void> {
  await rm(resolveSafe(mediaDir, relPath), { force: true });
}
