# Build context is the repository root, so the nginx config can be copied in
# alongside the bundle. Build with:  docker build -f frontend/Dockerfile .
FROM node:24-alpine AS build

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY frontend/tsconfig.json frontend/vite.config.ts frontend/index.html ./
COPY frontend/public ./public
COPY frontend/src ./src
RUN npm run build

# The runtime image is nginx with the build baked in — no shared volume, no
# ordering problem between "build finished" and "nginx started".
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1
