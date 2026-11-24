# 技術棧與版本

| 範圍             | 使用                                      | 版本                     | 使用規定                                                                        |
| ---------------- | ----------------------------------------- | ------------------------ | ------------------------------------------------------------------------------- |
| 執行環境         | Node                                      | 26 LTS                   | 後端直接執行 TypeScript 原始碼，不 build                                        |
| 套件管理         | pnpm                                      | 12.23                    | 版本統一寫在 `pnpm-workspace.yaml` 的 catalog，`package.json` 只寫 `"catalog:"` |
| 語言             | TypeScript                                | 7.0                      | strict                                                                          |
| Lint / 格式      | oxlint（type-aware）、oxfmt               | 1.94 / 0.79              |                                                                                 |
| 前端             | React、Vite                               | 19.3 / 8.3               |                                                                                 |
| 路由             | TanStack Router                           | 1.170                    | 檔案路由                                                                        |
| 資料取得         | TanStack Query                            | 5.108                    |                                                                                 |
| 樣式             | Tailwind CSS                              | 4.3                      | 顏色用 `apps/web/src/styles.css` 的語意 token                                   |
| 元件             | Base UI                                   | 1.9                      | 文件在 `apps/web/node_modules/@base-ui/react/docs`                              |
| 拖拉             | @dnd-kit/core                             | 6.3.1（鎖定）            | 不使用 `@dnd-kit/react`                                                         |
| 日期             | 原生 input、`packages/shared/src/time.ts` | —                        | 一律台北時間                                                                    |
| 後端             | Hono、@hono/node-server                   | 4.13 / 2.1               | 維持 v4                                                                         |
| 驗證             | Zod                                       | 4.6                      | 契約放 `packages/shared`                                                        |
| 資料庫           | PostgreSQL                                | 18.7                     |                                                                                 |
| 本機與測試資料庫 | PGlite                                    | 0.6                      |                                                                                 |
| ORM              | Drizzle ORM、drizzle-kit                  | 0.45.4 / 0.31.11（鎖定） | 不使用 v1 的寫法；只用 generate + migrate，不用 push                            |
| Postgres 驅動    | pg                                        | 8.23                     |                                                                                 |
| 登入             | LINE Login v2.1（自行實作）               | —                        | 授權碼 + PKCE S256 + state + nonce                                              |
| Session          | 自行實作                                  | —                        | `id.secret` token，資料庫存 SHA-256，10 天滑動過期                              |
| 3D 格局          | three（GLTFLoader）                       | 0.187.0                  | GLB                                                                             |
| 3D 實景          | three、@sparkjsdev/spark                  | 0.187.0 / 2.4.0（鎖定）  | SPZ；只用 WebGLRenderer                                                         |
| 360 全景         | three.js（自行實作）                      | —                        |                                                                                 |
| 測試             | Vitest、Playwright                        | 5.1 / 1.65               |                                                                                 |
| 部署             | Docker Compose、Cloudflare Tunnel         | cloudflared 2026.11.1    | 見 `0002-deploy.md`                                                             |

## 不使用

- 元件庫（MUI、Ant Design 等）
- 日期套件（date-fns、dayjs 等）
- Pannellum
- `drizzle-kit push`
