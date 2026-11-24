# syntax=docker/dockerfile:1
# 正式環境映像檔：Hono 後端直接跑 TypeScript 原始碼（Node 26 內建型別剝除），同時提供前端靜態檔。
FROM node:26.13.1-trixie-slim AS base
ENV CI=true PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN npm install -g pnpm@12.23.0 && npm cache clean --force
WORKDIR /app

# 所有依賴（含 dev），用來 build 前端
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @class/web build

# 只有後端執行需要的依賴
FROM base AS prod-deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile --prod --filter @class/api...

FROM node:26.13.1-trixie-slim AS runtime
ENV NODE_ENV=production PORT=3000 WEB_DIST_DIR=/app/apps/web/dist MEDIA_DIR=/data/media
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY package.json ./
COPY apps/api/package.json apps/api/
COPY apps/api/src apps/api/src
COPY apps/api/drizzle apps/api/drizzle
COPY packages/shared/package.json packages/shared/
COPY packages/shared/src packages/shared/src
COPY --from=build /app/apps/web/dist apps/web/dist
RUN mkdir -p /data/media && chown node:node /data/media
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "apps/api/src/index.ts"]
