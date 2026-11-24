# 部署

- 主機：雲端主機（Docker Compose），專案目錄 `~/se-final-project`。
- 對外：Cloudflare Tunnel `class` → `https://class.asdxcvw.com`，不開對外 port。
  - 轉發規則在 `deploy/cloudflared/config.yml`。
  - 憑證 `credentials.json` 只放在主機上。
- 容器（compose 專案 `class`），每個都有記憶體上限：
  - `app`：Hono，同時提供前端靜態檔與 `/media`
  - `db`：PostgreSQL 18.7
  - `backup`：每日 `pg_dump`，保留 7 天
  - `tunnel`：cloudflared
- 機密只放 `~/se-final-project/.env`（權限 600），不進 git。
- 部署：`scripts/deploy.sh`（rsync 原始碼 → 在主機 build 映像檔並重啟 → 健康檢查）。退回上一版：`scripts/deploy.sh --rollback`。
- 主機位址寫在本機 repo 根目錄的 `.env.deploy`（不進 git）：`DEPLOY_HOST`（必填）、`DEPLOY_REMOTE_PATH`、`DEPLOY_DIR`（選填）。
- migration 在 app 啟動時自動執行。
- 只有整合者部署。組員在本機開發、開 PR；合併到 main 後由整合者部署。

## 目錄

```
~/se-final-project/
  app/            rsync 目標（repo 內容，不含 node_modules、.git、.env）
  .env            機密
  cloudflared/    tunnel 憑證
  data/media/     上傳的媒體檔
  data/backups/   每日備份
PostgreSQL 資料：named volume class_pgdata
```
