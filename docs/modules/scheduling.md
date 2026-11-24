# 模組 3：課程排課（scheduling）

需求：SCHED-1 ～ SCHED-9、INT-2（見 `docs/requirements.md`）。
擁有的檔案：

- `apps/api/src/modules/scheduling/`、`apps/api/src/db/schema/scheduling.ts`、`apps/api/test/scheduling.test.ts`
- `apps/web/src/routes/scheduling/`、`apps/web/src/modules/scheduling/`
- `packages/shared/src/scheduling.ts`
- 本文件的 `## 進度`

資料表 `courses`、`course_sessions` 已經建好。`pnpm --filter @class/api db:seed -- --demo` 會建兩位示範教師、三門課，其中兩門故意衝突。

## 進度

做完一個任務，就在同一個 PR 裡把它打勾。開工時從第一個沒打勾的任務開始。

- [ ] C1 課程增刪改 API
- [ ] C2 我的課程與課程表單
- [ ] C3 時段 API 與表單
- [ ] C4 排課週曆
- [ ] C5 管理員指派教師
- [ ] C6 衝突清單
- [ ] C7 拖拉調整時段
- [ ] C8 週曆疊加預約

## 真實課程資料（整合者負責）

- 每學期從 iNCNU 公開課表（訪客查詢）匯入一次快照：`apps/api/src/cli/seed-data/incnu-<學期>.json`，範圍是「上課教室在管院大樓」的所有課程，包含外院開在管院的課。
- 行事曆：`seed-data/calendar-<學期>.json`（上課起訖日、停課日），來源是教務處年度行事曆。
- 匯入：`pnpm --filter @class/api import-courses -- 1151`（正式站：`docker exec class-app-1 node apps/api/src/cli/import-courses.ts 1151`）。節次時間與解析規則見 `apps/api/src/cli/incnu/parse.ts`。
- 匯入的課程 `source = incnu`，教師還沒有帳號時用 `teacherName` 顯示（`teacherLabel()`）；教師註冊後由管理員在 C5 指派帳號。
- 重新匯入會重建匯入課程的時段，手動拖拉過的匯入時段會被覆蓋。

## 名詞

- **課程（course）**：課名、課號、授課教師、希望的教室。
- **時段（session）**：某一天的某段時間，在某間教室上這門課。一門課有多個時段。需求說的「登記想排課的時段（日期、區間、希望的教室）」就是建立時段。
- 時段可以一次建立「每週重複 N 次」（`repeatWeeks`）。

## API 一覽

全部掛在 `/api/scheduling`，所有端點都至少要 `course.view`（已登入且核准）。DTO 在 `packages/shared/src/scheduling.ts`。

| 方法與路徑                            | 權限                          | 說明                                                                             | 任務   |
| ------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------- | ------ |
| `GET /courses?mine=1`                 | `course.view`                 | `{ courses: CourseDto[] }`。`mine=1` 只回自己教的課；管理員不帶參數看全部        | C1     |
| `GET /courses/:id`                    | `course.view`                 | `{ course: CourseDto, sessions: SessionDto[] }`                                  | C1     |
| `POST /courses`                       | `course.create`               | body `CourseInput` → 201。教師建立時 `teacherId` 強制為自己，管理員可指定或留空  | C1     |
| `PATCH /courses/:id`                  | `canEditCourse`               | 改課名、課號、希望的教室、說明。教師不能改 `teacherId`                           | C1     |
| `DELETE /courses/:id`                 | `canEditCourse`               | 連同時段一起刪 → `{ ok: true }`                                                  | C1     |
| `PUT /courses/:id/teacher`            | `course.manageAll`            | body `AssignTeacherInput`                                                        | C5     |
| `GET /teachers`                       | `course.manageAll`            | `{ teachers: UserRef[] }`：已核准的教師（給指派下拉選單用）                      | C5     |
| `POST /courses/:id/sessions`          | `canEditCourse`               | body `CreateSessionsInput` → 201 `{ sessions }`；`roomId` 省略時用課程的希望教室 | C3     |
| `PATCH /sessions/:id`                 | `canEditCourse`（看所屬課程） | body `UpdateSessionInput`；拖拉也用這個                                          | C3、C7 |
| `DELETE /sessions/:id`                | `canEditCourse`               |                                                                                  | C3     |
| `GET /calendar?week&roomId&teacherId` | `course.view`                 | `{ sessions: SessionDto[] }`：該週（週一起 7 天）所有 `scheduled` 時段           | C4     |
| `GET /conflicts?from&to`              | `course.viewConflicts`        | `{ conflicts: ConflictDto[] }`，見 C6                                            | C6     |

權限判斷用 shared 的 `canEditCourse(actor, course)`，沒權限回 403 `FORBIDDEN`。
課程時段**不受預約限制**（課程優先），建立和移動時段都不用檢查占用。

細部規則：

- `GET /courses` 不帶 `mine`：所有已核准的人都看得到全部課程。
- 「已核准的教師」= `role = teacher` 且 `status = approved`。管理員不能被指派為授課教師。建立或修改課程時指定的 `teacherId` 也要符合，否則 400。
- `sessionCount` 只算 `scheduled` 的時段。
- 時段時間限制在 07:00–22:00、以 10 分鐘為單位（週曆只顯示這個範圍）。
- `week` 參數不是週一時，後端換成那一週的週一。
- 教室不存在或已停用回 400。
- 取消單一時段（例如放假）目前用刪除時段處理；`cancelled` 狀態保留給之後的「停課」功能，現在沒有 API 會設定它。
- 衝突清單只開放管理員。教師拖拉自己的課之後只提示「已移動」，不檢查衝突。
- 一般使用者的教師篩選選項，從 `GET /courses` 出現過的教師組出來（`GET /teachers` 只給管理員）。

## 頁面一覽

| 路徑                            | 權限                         | 內容                                                         | 任務   |
| ------------------------------- | ---------------------------- | ------------------------------------------------------------ | ------ |
| `/scheduling`                   | 已登入                       | 全院排課週曆（可依教室、教師篩選）；教師另有「我的課程」清單 | C2、C4 |
| `/scheduling/courses/$courseId` | 已登入（編輯限本人或管理員） | 課程資料 + 時段清單 + 新增時段（含每週重複）                 | C2、C3 |
| `/scheduling/admin`             | 管理員                       | 全部課程表格 + 指派教師 + 可拖拉的週曆                       | C5、C7 |
| `/scheduling/admin/conflicts`   | 管理員                       | 衝突清單                                                     | C6     |

`/scheduling` 和 `/scheduling/admin` 的佔位頁已存在，直接替換內容。

手機（見 `AGENTS.md`「手機與電腦一樣重要」）：

- 週曆用 `WeekGrid`，手機上會自動變成單日檢視。篩選列在手機上收成一列下拉選單。
- 課程清單、衝突清單用 `DataTable`（手機變卡片）。
- 拖拉：手機上長按後只能在同一天內上下移動。時段詳細的 Dialog 一定要有「編輯時間」，可以改日期。

---

## 任務

### C1 課程增刪改 API（P1）

- 實作上表 C1 的端點。
- `CourseDto.sessionCount` 用子查詢或 group by 算。
- 教師與 `teacherId`：
  - 教師建立課程時，忽略 body 的 `teacherId`，一律設成自己。
  - 教師 `PATCH` 時帶了 `teacherId` 而且不是自己，回 403。
- 驗收：`test/scheduling.test.ts` C1 區塊。

### C2 我的課程與課程表單（P1）

- `/scheduling`：
  - 教師與管理員看到「我的課程」清單（課號、課名、希望的教室、時段數），有「新增課程」按鈕。
  - 一般使用者只看週曆（C4）。
- 新增/編輯課程用 `Dialog`。希望的教室用 `Select`，選項來自核心的 `GET /api/rooms?bookable=1`（`api.rooms.$get`）。
- 管理員在 `/scheduling` 看到的是「全部課程」而不是「我的課程」。
- `/scheduling/courses/$courseId`：課程資料、時段清單（日期、時間、教室）、刪除課程（`ConfirmDialog`）。
- 驗收：API 部分在 C1；頁面手動驗收（測試檔沒有 C2 區塊）。

### C3 時段 API 與表單（P1）

- `POST /courses/:id/sessions`：從 `date` 起每週一次，共 `repeatWeeks` 次。用 `toInstant(date, time)` 換算，**不要用 `new Date(...)` 拼字串**。建立要在同一個 transaction。
- `PATCH /sessions/:id`、`DELETE /sessions/:id`。
- 課程頁加「新增時段」表單：日期（`type="date"`）、開始/結束時間（`type="time" step="600"`）、教室、每週重複次數。
- 驗收：C3 區塊。

### C4 排課週曆（P1）

- `GET /calendar?week=YYYY-MM-DD`（週一）。範圍用 `weekRange(week)`。
- `/scheduling` 用 `WeekGrid` 與 `WeekNav` 顯示：
  - 事件標題是課名，副標是教室代碼與教師。
  - `tone: "course"`；自己的課用 `tone: "booking"` 區分顏色也可以。
- 篩選列：教室、教師（下拉）。篩選條件放在網址 search params（`validateSearch`），重新整理不會遺失。
- 點時段打開詳細資訊（Dialog），有權限的人看到「編輯」。
- 驗收：C4 區塊。

### C5 管理員指派教師（P2）

- `PUT /courses/:id/teacher`、`GET /teachers`。
- `/scheduling/admin`：全部課程表格，教師欄是下拉選單，選了就指派。也可以在這裡新增未指派教師的課程。
- 驗收：C5 區塊。

### C6 衝突清單（P2，含 INT-2）

`GET /conflicts?from&to` 回傳三種衝突（`ConflictKind`），都只看 `status = scheduled` 的時段：

1. `room_course`：同一教室兩個時段重疊。用 SQL self-join：`a.room_id = b.room_id AND a.id < b.id AND a.starts_at < b.ends_at AND b.starts_at < a.ends_at`。
2. `teacher`：同一位教師（`courses.teacher_id`）兩個時段重疊。同一組時段如果同時是教室衝突，兩種都列。
3. `room_booking`：時段與已核准預約重疊。**呼叫 `core/occupancy.ts` 的 `listOccupancy({ sources: ["booking"], ... })`**，不要自己查 bookings 表。

規則：

- `from`、`to` 省略時預設今天起 8 週。
- 頁面 `/scheduling/admin/conflicts`：依種類分組，每筆顯示兩邊的標籤與時間、教室或教師，並提供「到週曆調整」連結（帶 `week` 與 `roomId`）。
- 驗收：C6 區塊。

### C7 拖拉調整時段（P2）

- `/scheduling/admin` 的週曆 `WeekGrid` 傳 `onEventMove`，事件設 `draggable: true`。
- 放下後呼叫 `PATCH /sessions/:id`，日期與時間從 `onEventMove` 給的 start/end 用 `taipeiParts` 取出。
- 用 TanStack Query 的 optimistic update：先移動，失敗時還原並 `toast.error`。
- 拖完如果造成衝突，用 toast 提示「已移動，但與 X 衝突」（呼叫 conflicts API 檢查該週即可）。
- 教師在 `/scheduling` 的週曆上也可以拖自己的課（`canEditCourse`）。
- 驗收：C7 區塊（API）+ 手動（滑鼠與觸控板各一次）。

### C8 週曆疊加預約（P3，INT-2）

- 週曆有「顯示教室借用」開關，開啟時用 `GET /api/occupancy?from&to[&roomId]` 取 `source = "booking"` 的項目，以 `tone: "muted"` 顯示且不可拖拉。
- 驗收：手動。
