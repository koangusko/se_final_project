---
name: task
description: 開始做 docs/modules 裡的一個任務，例如「/task S3」「/task C6」或「/task 模組 2」（從該模組下一個還沒完成的任務開始）。讀規格與驗收測試，實作到 pnpm verify 通過並回報。
---

# 做一個任務

參數是任務編號（S1–S9 空間查詢、B1–B8 預約借用、C1–C8 課程排課），或模組編號（1 空間查詢、2 預約借用、3 課程排課，也可能寫成「第二模組」「模組 2」）。

- 給模組編號時：讀 `docs/modules/<模組>.md` 的 `## 進度`，做第一個沒打勾、而且還沒有分支或 PR 的任務（用 `git branch -a --list "*<模組英文名>/*"` 與 `gh pr list --state open` 查）。全部打勾了就告訴使用者。
- 什麼都沒給：問使用者要做哪個模組或任務。

0. 先 `git switch main && git pull && pnpm install`，再開分支 `<模組英文名>/<任務編號小寫>-<簡述>`（例如 `booking/b1-items`）。
   - 已經在這個任務的分支上就直接繼續。
   - 前置任務還在沒合併的分支上時，從那個分支開新分支，並在回報與 PR 說明寫明依賴哪個 PR（PR 仍開在 main）。

1. 找到任務：編號開頭 S 是 `docs/modules/space.md`，B 是 `booking.md`，C 是 `scheduling.md`。讀整份模組規格（不只該任務段落），以及根目錄 `AGENTS.md`。
2. 讀相關的契約與既有程式：`packages/shared/src/<模組>.ts`、`apps/api/src/modules/<模組>/`、`apps/api/src/db/schema/<模組>.ts`、`apps/web/src/routes/<模組>/`、`apps/web/src/modules/<模組>/`、`apps/api/test/<模組>.test.ts` 裡該任務的 `it.todo`，以及測試工具 `apps/api/test/helpers.ts`、`apps/api/test/fixtures.ts`。
3. 確認任務段落「前置」列出的任務都已完成。沒完成就先告訴使用者。
4. 先把該任務的 `it.todo` 改成真的測試（測試名稱不改），確認它們失敗。如果 API 在前一個任務已經做好、測試一寫就通過，確認測試真的有檢查到需求（例如故意改錯一次看它會失敗）即可。
5. 實作後端，讓測試通過；再實作前端頁面。
6. 執行 `pnpm verify`，全部通過為止。
7. 用 `pnpm dev` 實際操作（可以請使用者協助），手機寬度也要看。
8. 在模組規格 `## 進度` 把這個任務打勾。
9. 回報：
   - 完成的任務與需求編號
   - 新增或修改的檔案
   - 是否動到模組以外的檔案、是否改了資料表（改了要提醒 PR 標題加 `[schema]`）
   - 手動驗收的結果，以及還沒做完或不確定的地方
10. 問使用者要不要開 PR（`/pr`）。

只改自己模組的檔案。需要改共用檔案（`core/`、`components/ui/`、`routes.ts` 等）時停下來，說明需要什麼，讓使用者轉告整合者。
