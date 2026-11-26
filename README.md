# 管院空間系統

暨大管理學院的空間查詢、空間/物品預約借用、課程排課系統（1151 軟體工程學期專案）。

線上版本：https://class.asdxcvw.com

## 模組

每位組員負責一個模組，開工前先讀該模組的規格。

| 模組 | 名稱                         | 任務編號 | 規格                         |
| ---- | ---------------------------- | -------- | ---------------------------- |
| 1    | 管院空間查詢（space）        | S1–S9    | `docs/modules/space.md`      |
| 2    | 空間/物品預約借用（booking） | B1–B8    | `docs/modules/booking.md`    |
| 3    | 課程排課（scheduling）       | C1–C8    | `docs/modules/scheduling.md` |

共用基礎（帳號、資料表、共用元件、部署）由整合者維護，見 `docs/domain.md`、`docs/adr/`。

## 在自己的電腦跑起來

不需要安裝資料庫、Docker 或 LINE 開發者帳號。本機資料庫是內建的 PGlite，登入用「開發用登入」。

### 1. 安裝工具（只做一次）

| 工具        | 版本       | 安裝                                                | 確認                         |
| ----------- | ---------- | --------------------------------------------------- | ---------------------------- |
| Git         | 任何版本   | https://git-scm.com                                 | `git --version`              |
| Node.js     | 26.10 以上 | https://nodejs.org 下載 LTS（26.x），或用 fnm / nvm | `node -v` 要顯示 `v26.` 開頭 |
| pnpm        | 12         | `npm install -g pnpm@12`                            | `pnpm -v` 要顯示 `12.` 開頭  |
| Claude Code | 最新版     | https://claude.com/claude-code                      | `claude --version`           |
| GitHub CLI  | 任何版本   | https://cli.github.com，裝好後 `gh auth login`      | `gh auth status`             |

pnpm 會依照 `package.json` 的 `packageManager` 自動切換到專案指定的版本。

### 2. 第一次啟動

```bash
git clone https://github.com/koangusko/se_final_project.git
cd se_final_project
pnpm install
pnpm db:seed      # 管院教室主檔 69 間、可借物品（必做）
pnpm db:courses   # 115-1 在管院大樓上課的真實課表 239 門（選做，做排課與預約時建議匯入）
pnpm db:demo      # 示範教師、示範課程與預約（選做）
pnpm dev          # 啟動後端 http://localhost:3000 與前端 http://localhost:5173
```

打開 http://localhost:5173 ，按右上角「登入」，在「開發用登入」選身分：

| 身分       | 用來測                                 |
| ---------- | -------------------------------------- |
| 管理員     | 帳號審核、教室管理、預約審核、排課管理 |
| 教師       | 登錄自己的課程                         |
| 一般使用者 | 預約、借用紀錄                         |
| 待審核者   | 還沒被核准時看到的畫面                 |

要換身分：右上角頭像選單 → 登出，再用另一個身分登入。開發用登入只在本機出現，正式站沒有。

### 3. 用手機測試

每個頁面都要在手機上試過。

1. 手機和電腦連同一個 Wi-Fi。
2. 執行 `pnpm dev:phone`（取代 `pnpm dev`）。
3. 終端機會印出 `Network: http://192.168.x.x:5173`，用手機瀏覽器打開這個網址。

連不到時：電腦防火牆要允許 Node 的連線；學校 Wi-Fi 常會隔離裝置，可以改用手機熱點讓電腦連上。只想快速看版面，也可以用電腦瀏覽器的開發者工具切到 iPhone 寬度（375px）。

### 4. 測試與檢查

| 指令                                               | 用途                                                           |
| -------------------------------------------------- | -------------------------------------------------------------- |
| `pnpm test`                                        | 跑全部測試                                                     |
| `pnpm test:watch`                                  | 改檔案時自動重跑                                               |
| `pnpm exec vitest run apps/api/test/space.test.ts` | 只跑一個測試檔                                                 |
| `pnpm verify`                                      | 開 PR 前的完整檢查：型別、lint、格式、模組邊界、測試，全部要過 |
| `pnpm format`                                      | 自動排版                                                       |

- 每個測試檔都用自己的記憶體資料庫，不會動到本機資料。
- 驗收測試在 `apps/api/test/<模組>.test.ts`，一開始是 `it.todo`，做任務時改成真的測試。

### 5. 本機資料

- 資料庫和上傳的檔案都在 `apps/api/.data/`，不會進 git。
- 想從頭來過：`pnpm db:reset`，再 `pnpm db:seed`（需要的話再 `pnpm db:courses`、`pnpm db:demo`）。
- 改了資料表：`pnpm db:generate` 產生 migration，重新啟動 `pnpm dev` 就會自動套用。PR 標題要加 `[schema]`。

### 6. 常見問題

| 狀況                              | 處理                                                            |
| --------------------------------- | --------------------------------------------------------------- |
| `pnpm install` 失敗或版本錯誤     | `node -v` 要 26 以上、`pnpm -v` 要 12 開頭                      |
| 啟動時說 port 3000 或 5173 被占用 | 另一個 `pnpm dev` 還開著，先關掉它                              |
| 登入後又跳回登入頁                | 清掉瀏覽器的 localhost cookie，或 `pnpm db:reset` 後重來        |
| 頁面空白或一直轉圈                | 看終端機的錯誤訊息；拉了新的 main 之後要再跑一次 `pnpm install` |
| 想測真的 LINE 登入                | 本機不需要，一律用開發用登入；LINE 登入只在正式站測             |

正式站的部署只有整合者會做（見 `docs/adr/0002-deploy.md`），組員不需要也不會碰到伺服器。

## 工作流程

我們用 Claude Code 開發，每個人負責自己的模組。agent 的規則寫在 `AGENTS.md`，任務寫在 `docs/modules/<模組>.md`。

### 階段

| 階段    | 內容                                                        | 誰              |
| ------- | ----------------------------------------------------------- | --------------- |
| P0 基礎 | 帳號、資料表、共用元件、部署、規格與驗收測試                | 整合者          |
| P1 核心 | S1–S3、B1–B6、C1–C4                                         | 各模組          |
| P2 進階 | S4–S8（平面圖、全景、3D）、B7–B8、C5–C7（指派、衝突、拖拉） | 各模組          |
| P3 整合 | S9、C8，整體測試與 demo 準備                                | 各模組 + 整合者 |

### 做一個任務

1. 用 Claude Code 開 clone 下來的 `se_final_project` 資料夾，說「做第 N 模組」（N 是 1、2、3），或輸入 `/task N`；要指定任務就輸入 `/task S3`。
   - agent 一個任務開一個分支（`<模組英文名>/<任務編號小寫>-<簡述>`，例如 `space/s3-room-crud`）：讀規格、實作、把驗收測試從 todo 改成真的測試、`pnpm verify`、在模組規格的「進度」打勾，再 commit、push、開 PR，CI 通過後合併（merge commit），接著做下一個任務，直到模組做完。
   - 需要改共用檔案、`pnpm verify` 修不過、改了資料表時，agent 會停下來回報。
   - 用其他 agent（Codex、Cursor 等）時，它會自動讀 `AGENTS.md`；直接說「照 `.claude/skills/task/SKILL.md` 做第 N 模組」。
2. 模組做完後，用 `pnpm dev:phone` 在手機上把 agent 列出的頁面走一遍（見上面「用手機測試」），有問題直接告訴 agent 修。
3. 整合者部署到線上。

### main 有更新時

- 每個任務開始前都先 `git pull` main，再 merge 或 rebase 進自己的分支，並重新讀 `AGENTS.md` 與模組規格：規則和共用元件會隨專案進行更新。
- 整合者改規則或共用元件時，會在 PR 說明寫「給組員的變更摘要」。
- 自己的 PR 跟 main 衝突時：`git fetch && git merge origin/main`，解完衝突跑 `pnpm verify` 再推。不確定怎麼解，在 PR 留言請整合者處理。

### 規則

- 只改自己模組的檔案（見 `AGENTS.md`「專案結構與擁有者」）。需要改共用檔案時，在 PR 說明裡提出，由整合者處理。
- 不要自己加套件。
- 改資料表要在 PR 標題加上 `[schema]`，由整合者處理 migration 編號。
- commit 訊息格式：`feat(space): 教室增刪改 API（S3）`、`fix(scheduling): 週曆時區錯誤`、`test(booking): ...`。一個 commit 做一件事。
- 不要 commit `.env`、`apps/api/.data/`、個人設定（`CLAUDE.local.md`、`.claude/settings.local.json`）。

## 指令總覽

| 指令                            | 用途                                                                        |
| ------------------------------- | --------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm dev:phone`   | 開發伺服器（後端 3000、前端 5173）；`dev:phone` 讓同一個 Wi-Fi 的手機連得到 |
| `pnpm verify`                   | 開 PR 前的完整檢查                                                          |
| `pnpm test` / `pnpm test:watch` | 測試                                                                        |
| `pnpm format`                   | 排版                                                                        |
| `pnpm db:seed`                  | 教室主檔與可借物品                                                          |
| `pnpm db:courses`               | 匯入 115-1 真實課表                                                         |
| `pnpm db:demo`                  | 示範教師、課程、預約                                                        |
| `pnpm db:reset`                 | 刪掉本機資料庫，從頭來過                                                    |
| `pnpm db:generate`              | 改 schema 後產生 migration                                                  |

## 上線與管理員（整合者）

- 部署：`scripts/deploy.sh`，退回上一版：`scripts/deploy.sh --rollback`。細節見 `docs/adr/0002-deploy.md`。
- 第一位管理員：用 LINE 登入一次後，在主機上執行
  ```bash
  docker exec class-app-1 node apps/api/src/cli/grant-admin.ts --list
  docker exec class-app-1 node apps/api/src/cli/grant-admin.ts <id>
  ```
  之後的帳號由管理員在「帳號審核」頁核准。
- 每學期匯入真實課表：見 `docs/modules/scheduling.md`「真實課程資料」。
- 教室主檔：`apps/api/src/cli/seed-data/rooms.json`（管理要點附表二 + 管院網站 + 課表），`seed.ts` 以它為準。
- 3D 拍攝流程：`docs/3d-capture.md`。

## 文件

- `AGENTS.md`：agent 工作手冊（開工前先讀）
- `docs/requirements.md`：需求編號與對應任務
- `docs/domain.md`：資料模型、狀態、教室占用規則
- `docs/permissions.md`：權限矩陣
- `docs/adr/`：技術棧與部署
- `docs/modules/`：各模組規格與任務
- `docs/3d-capture.md`：教室 3D 拍攝流程
