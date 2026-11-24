# 管院空間系統：agent 工作手冊

暨大管理學院的空間查詢、空間/物品預約借用、課程排課系統。三個模組各由一位組員負責，共用帳號、資料庫與 repo。
這份文件是寫給在這個 repo 工作的 agent 看的（Claude Code、Codex、Cursor 等都適用）。先讀完再動手。

- agent 規則寫在這份 `AGENTS.md`（Git 流程在 `README.md`）。根目錄的 `CLAUDE.md` 只有一行 `@AGENTS.md`，不要在 `CLAUDE.md` 加內容。
- 個人偏好放自己的 `CLAUDE.local.md`（已在 .gitignore），不要改這份共用文件。

## 模組與開工

| 模組 | 名稱                         | 任務  | 規格                         |
| ---- | ---------------------------- | ----- | ---------------------------- |
| 1    | 管院空間查詢（space）        | S1–S9 | `docs/modules/space.md`      |
| 2    | 空間/物品預約借用（booking） | B1–B8 | `docs/modules/booking.md`    |
| 3    | 課程排課（scheduling）       | C1–C8 | `docs/modules/scheduling.md` |

使用者說「開工第 N 模組」「做模組 N」或只給任務編號（例如 B3）時，照 `.claude/skills/task/SKILL.md` 的流程做：

1. 先 `git switch main && git pull && pnpm install`。
2. 找出該模組第一個還沒完成的任務：模組規格 `## 進度` 裡第一個沒打勾的任務。
3. 開分支 `<模組英文名>/<任務編號小寫>-<簡述>`（例如 `booking/b1-items`），只做這一個任務。
4. 做完在 `## 進度` 打勾，回報後問使用者要不要開 PR（`/pr`）。下一個任務從最新的 main 開新分支；需要前一個還沒合併的任務的程式時，從前一個任務的分支開。

## 先讀這些

| 要做什麼                          | 讀哪裡                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| 接到任務（例如 S3、B2、C6）或模組 | `docs/modules/<模組>.md` 裡的任務段落，以及它引用的 `docs/requirements.md` 需求編號 |
| 資料表、狀態、教室占用規則        | `docs/domain.md`                                                                    |
| 誰能做什麼                        | `docs/permissions.md`，程式在 `packages/shared/src/permissions.ts`                  |
| 用哪些套件與版本、部署方式        | `docs/adr/`                                                                         |

## 指令

```bash
pnpm install          # 第一次，以及每次拉了新的 main 之後
pnpm db:seed          # 教室主檔 69 間與可借物品（可重複執行）
pnpm db:courses       # 匯入 115-1 真實課表（選用）
pnpm db:demo          # 示範教師、課程、預約（選用）
pnpm db:reset         # 刪掉本機資料庫從頭來過，之後再 pnpm db:seed
pnpm dev              # 後端 :3000 + 前端 :5173，打開 http://localhost:5173
pnpm dev:phone        # 同上，並讓同一個 Wi-Fi 的手機用終端機印出的 Network 網址連進來
pnpm verify           # 型別 + lint + 格式 + 模組邊界 + 測試。交出去之前一定要全過
pnpm test             # 只跑測試；單一檔案：pnpm exec vitest run apps/api/test/space.test.ts
pnpm format           # 自動排版
pnpm db:generate      # 改了 apps/api/src/db/schema 之後產生 migration
```

本機不用裝資料庫：沒有 `DATABASE_URL` 時後端自動用 PGlite（資料存在 `apps/api/.data/`，刪掉就重置）。
登入頁有「開發用登入」按鈕，可以直接以管理員、教師、一般使用者、待審核者身分登入，不需要 LINE。

## 專案結構與擁有者

```
packages/shared/src/        前後端共用：Zod 契約、權限、台北時間工具
  space.ts booking.ts scheduling.ts   各模組的契約（模組擁有者可改）
  core.ts occupancy.ts permissions.ts time.ts errors.ts   核心（整合者）
apps/api/src/
  modules/<模組>/routes.ts  模組 API 入口（已經掛在 /api/<模組>）
  modules/<模組>/*.ts       模組的 service、helper（自由新增）
  core/                     共用：錯誤、驗證、權限守門、教室占用、媒體檔（整合者）
  auth/ admin/              LINE 登入、session、帳號審核（整合者）
  db/schema/<模組>.ts       資料表定義（改之前看「改資料表」一節）
  routes.ts app.ts env.ts   組裝（整合者）
apps/api/test/
  <模組>.test.ts            模組的驗收測試（已列好 it.todo）
  helpers.ts fixtures.ts    測試工具
apps/web/src/
  routes/<模組>/            模組頁面（TanStack Router 檔案路由）
  modules/<模組>/           模組的元件、hook
  components/ui/            共用 UI 元件（整合者）
  components/week-grid/     共用週曆（整合者）
  lib/                      api 呼叫、登入狀態（整合者）
```

模組只能改自己的資料夾。需要改「整合者」的檔案時，不要直接改，在回報裡寫清楚需要什麼、為什麼，由整合者處理。
`pnpm check:boundaries` 會擋住模組之間互相 import。

## 寫後端

- route 一律用串接寫法：
  ```ts
  export const spaceRoutes = new Hono<AppEnv>()
    .get("/rooms", validate("query", RoomListQuery), async (c) => { ... return c.json({ rooms }); })
    .post("/rooms", requireAction("space.manage"), validate("json", RoomInput), async (c) => { ... return c.json({ room }, 201); });
  ```
- 輸入驗證用 `core/validate.ts` 的 `validate(target, schema)`，schema 放在 `packages/shared/src/<模組>.ts`。
- 權限用 `core/guards.ts`：`requireAction("booking.review")`（middleware）、`requireApproved(c)`（取得目前使用者）。規則本身在 shared 的 `permissions.ts`。
- 錯誤一律 `throw`（`notFound("教室")`、`invalidState("已核准的預約不能再核准")`、`new AppError(409, "ROOM_OCCUPIED", ...)`），不要自己 `c.json({...}, 4xx)`。錯誤碼列在 `packages/shared/src/errors.ts`。
- 回應一律 `{ 名詞: 資料 }`：`{ rooms: RoomDto[] }`、`{ booking: BookingDto }`。建立成功用 201。時間一律回 ISO 字串。
- 資料庫用 `c.var.db`（Drizzle）。讀別的模組的資料表可以（schema 是共用的），但**寫入只能寫自己模組的表**。
- 需要教室清單（下拉選單、篩選）時用核心的 `GET /api/rooms[?bookable=1]`（前端 `api.rooms.$get(...)`），不要依賴空間模組的 API。教室的完整資料才用 `/api/space/...`。
- **教室占用只能呼叫 `core/occupancy.ts`**（`listOccupancy`、`assertRoomFree`），不要自己寫「查預約 + 查課程」的重疊判斷。
- 多步驟寫入用 transaction：`await c.var.db.transaction(async (tx) => { ... })`。
- 上傳檔案用 `core/media.ts` 的 `saveRequestBody`（串流寫檔、有大小限制），網址用 `mediaUrl(path)`。

## 寫前端

- 呼叫 API：`unwrap(api.space.rooms.$get())`。路徑和型別都由後端推導，打錯會編譯失敗。搭配 TanStack Query（`useQuery` / `useMutation`），query key 以模組名開頭：`["space", "rooms"]`。
- 頁面放 `apps/web/src/routes/<模組>/`，需要登入的頁面加 `beforeLoad: requireApproved`，管理頁加 `beforeLoad: requireRole(["admin"])`。
- UI 一律用 `components/ui` 的元件（Button、Field、Input、Select、Dialog、ConfirmDialog、DataTable、Badge、toast...）。顏色用語意 token（`bg-surface`、`text-ink-muted`、`bg-accent`），不要寫 `bg-teal-700` 這種原始色。
- `components/ui` 沒有的元件（例如頁籤）在自己模組的 `modules/<模組>/` 裡用 Base UI 或一般元素做，頁籤狀態放網址參數 `tab`。
- 週曆用 `components/week-grid` 的 `WeekGrid`，不要自己刻。拖拉只能用 `@dnd-kit/core` v6，**不要用 `@dnd-kit/react`**。
- 日期時間用原生 `<input type="date">` / `<input type="time">`，換算一律用 `@class/shared/time`（台北時間）。**不要用 `Date#getHours()` 之類的方法**。
- 介面文字一律繁體中文。不要用 emoji。

### 手機與電腦一樣重要

每個頁面（包含管理頁）都要在手機與電腦上都好用。

- 列表一律用 `DataTable`：電腦上是表格，手機上自動變卡片。用 `mobile` 指定每一欄在卡片上的位置（title / subtitle / badge / meta / hide）。不要直接寫 `<table>`。
- 週曆 `WeekGrid` 在手機上會自動切成單日檢視（上方切換星期），觸控拖拉要長按。手機上不能跨天拖拉，「改日期」一定要有表單可以改。
- 版面從手機寫起（預設單欄），再用 `sm:` / `md:` 加寬。不要用固定寬度（`w-[800px]`），不要讓整頁出現左右捲軸。
- 按鈕、輸入框的觸控大小和 iOS 不放大的字級已經在共用元件處理好；自己做可點擊的東西時，高度至少 `min-h-11`（44px）。
- 不要依賴 hover 才看得到的資訊或按鈕（手機沒有 hover）。
- Dialog 在手機上是從底部滑出的面板，內容太長時會捲動；表單放得下就用 Dialog，太長就做成獨立頁面。
- 完成任務前，用瀏覽器開發者工具切到 iPhone 寬度（375px）把每個頁面走一遍。

## 測試

- 每個任務都有驗收測試，在 `apps/api/test/<模組>.test.ts`，先是 `it.todo(...)`。做任務時把對應的 todo 改成真的測試並讓它通過；測試名稱不要改，那是需求的對照。
- 測試用 `createTestContext()` 建立獨立的記憶體資料庫，`t.createUser({ role: "admin" })` 建使用者，`t.request(url, { as: user, json })` 打 API。
- 需要別的模組的資料當前置條件時，用 `test/fixtures.ts` 直接寫資料庫，不要呼叫別的模組的 API。
- 純邏輯（時間計算、版面計算）寫單元測試，放在檔案旁邊（`foo.test.ts`）。

## 改資料表

1. 改 `apps/api/src/db/schema/<自己的模組>.ts`。
2. `pnpm db:generate` 產生 migration，檢查產生的 SQL。
3. **資料表變更要在回報裡特別標出**，migration 編號由整合者合併時重新產生。
4. 不要用 `drizzle-kit push`，不要手改已經存在的 migration。

## 套件

- 不要自己加套件。真的需要時在回報裡說明理由，由整合者決定。版本統一在 `pnpm-workspace.yaml` 的 catalog。
- 不確定套件的 API 時：
  - Base UI：`apps/web/node_modules/@base-ui/react/docs/react/components/<元件>.md`（套件內附文件）
  - Drizzle 用 0.45（不是 v1），TanStack Router 用檔案路由，Hono 用 v4，Zod 用 v4（`z.uuid()`、`z.int()`）。
  - 查不到就讀 `node_modules/<套件>` 裡的型別定義，不要猜。
- 已知陷阱：
  - PATCH 不要用 `XxxInput.partial()` 驗證，要另外定義沒有 default 的 schema（範例：`packages/shared/src/booking.ts` 的 `ItemPatch`）。
  - `DataTable` 的 `cell: (row) => <Badge .../>` 寫在元件裡是允許的（lint 已設定），不用搬到元件外。
  - **前端的型別檢查會一路檢查到後端原始碼**。後端檔案只要被 route import，就必須在前後端都通過型別檢查；Node 與 DOM 同名但不相容的型別（例如 `ReadableStream`）要明確寫 `import type ... from "node:stream/web"`。
  - 上傳檔案的網址：`"/api" + api.space.rooms[":id"].media.$path({ param: { id } })`，再交給 `uploadFile()`。不要用 `$url()`。
  - Zod 的預設錯誤訊息已設定成繁體中文（`z.config(z.locales.zhTW())`），自訂訊息仍然優先。

## 完成一個任務

1. 先 `git fetch origin && git merge origin/main`，重新讀 `AGENTS.md` 與模組規格。整合者每次改規則都會在 PR 說明寫「給組員的變更摘要」。
2. 讀任務規格與驗收測試。
3. 實作，把對應的 `it.todo` 改成真測試。
4. `pnpm verify` 全過。
5. 用 `pnpm dev` 實際操作一次，電腦寬度與手機寬度（375px）都要走過。
6. 在模組規格的 `## 進度` 把任務打勾。
7. 回報：做了什麼、對應的任務與需求編號、有沒有碰到模組外的檔案或資料表變更、還沒做完的地方。

Git 流程與分支規則見 `README.md`。commit 訊息用 `feat(booking): 建立預約 API（B2）` 這種格式，scope 是模組名。
