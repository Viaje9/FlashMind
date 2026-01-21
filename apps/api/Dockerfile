# ================================
# Stage 1: Build
# ================================
FROM node:22-alpine AS builder

# 安裝 pnpm
RUN corepack enable && corepack prepare pnpm@10.26.2 --activate

WORKDIR /app

# 複製 workspace 設定檔
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./

# 複製所有 packages 和 apps 的 package.json
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma/
COPY packages/ ./packages/

# 安裝依賴
RUN pnpm install --frozen-lockfile

# 複製 API 原始碼
COPY apps/api/ ./apps/api/

# 產生 Prisma Client
RUN pnpm --filter api prisma:generate

# 建構 API
RUN pnpm --filter api build

# ================================
# Stage 2: Production
# ================================
FROM node:22-alpine AS runner

# 安裝 pnpm
RUN corepack enable && corepack prepare pnpm@10.26.2 --activate

WORKDIR /app

# 設定環境變數
ENV NODE_ENV=production

# 複製 workspace 設定檔
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma/
COPY packages/ ./packages/

# 只安裝 production 依賴
RUN pnpm install --frozen-lockfile --prod

# 產生 Prisma Client (production 環境也需要)
RUN pnpm --filter api prisma:generate

# 從 builder 複製建構產物
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# 暴露 API 埠號
EXPOSE 3000

# 啟動 API
WORKDIR /app/apps/api
CMD ["node", "dist/main"]
