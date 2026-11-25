/**
 * 開發用伺服器：只監看後端與 shared 的原始碼，改了就重啟。
 *
 * 不用 `node --watch`：透過 pnpm 執行時它會監看整個 repo，PGlite 每次寫資料檔都會觸發重啟，
 * 程序被砍時資料庫還沒寫完，session 就會遺失。這裡改成重啟前先等舊程序正常關閉。
 */
import { spawn, type ChildProcess } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const watched = [path.join(root, "src"), path.resolve(root, "../../packages/shared/src")];

let child: ChildProcess | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let restarting = false;

function start() {
  child = spawn(process.execPath, ["--env-file-if-exists=../../.env", "src/index.ts"], {
    cwd: root,
    stdio: "inherit",
  });
}

function stop(): Promise<void> {
  const c = child;
  if (!c || c.exitCode !== null || c.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    c.once("exit", () => resolve());
    c.kill("SIGTERM");
  });
}

async function restart(file: string) {
  if (restarting) return;
  restarting = true;
  console.log(`[dev] ${path.relative(root, file)} 有變更，重新啟動`);
  await stop();
  start();
  restarting = false;
}

for (const dir of watched) {
  watch(dir, { recursive: true }, (_event, name) => {
    if (!name || !/\.(ts|json)$/.test(name)) return;
    clearTimeout(timer);
    timer = setTimeout(() => void restart(path.join(dir, name)), 300);
  });
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void stop().then(() => process.exit(0)));
}

start();
