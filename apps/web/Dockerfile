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
COPY apps/web/package.json ./apps/web/
COPY packages/ ./packages/

# 安裝依賴
RUN pnpm install --frozen-lockfile

# 複製 Web 原始碼
COPY apps/web/ ./apps/web/

# 建構 Angular 應用
RUN pnpm --filter web build

# ================================
# Stage 2: Production (Nginx)
# ================================
FROM nginx:alpine AS runner

# 複製自訂 Nginx 設定
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# 從 builder 複製建構產物
COPY --from=builder /app/apps/web/dist/web/browser /usr/share/nginx/html

# 修改 Nginx 配置，監聽 8080 端口
RUN sed -i 's/listen 80;/listen 8080;/' /etc/nginx/conf.d/default.conf

# 暴露 HTTP 埠號
EXPOSE 8080

# 啟動 Nginx
CMD ["nginx", "-g", "daemon off;"]
