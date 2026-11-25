---
name: pr
description: 把目前分支的工作 commit、push 並開 PR。先確認 pnpm verify 通過。
---

# 開 PR

1. 確認不在 main 上；在 main 就停下來，請使用者先開分支（格式 `<模組英文名>/<任務編號小寫>-<簡述>`，例如 `booking/b1-items`）。
2. 執行 `pnpm verify`，沒過就先修（參考 /verify）。
3. 看 `git status` 與 `git diff`，只 stage 這個任務相關的檔案。
4. 擬好 commit 訊息：格式 `feat(<模組>): <做了什麼>（<任務編號>）`。改動大時拆成幾個有意義的 commit。
5. 給使用者看要 commit 的檔案與訊息，同意後才 commit 與 push（`git push -u origin <分支>`）。
6. `gh pr create --base main`（需要先 `gh auth login`）。PR 一律開在 main，就算分支是從前一個任務的分支開的也一樣；依賴還沒合併的 PR 時在說明寫「先合併 #X」。標題同 commit 訊息（有改資料表加 `[schema]`），內文依 `.github/pull_request_template.md` 填寫。
7. 回報 PR 網址。不要自己合併。
