# SQLite comes from node:sqlite, so there is nothing to compile and the
# alpine image needs no build toolchain.
FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

# Dependencies first, so a source-only change reuses this layer.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund

COPY src ./src
COPY scripts ./scripts

# The database lives on a volume so the demo survives a restart.
ENV DB_PATH=/data/gather.db
ENV PORT=4000
RUN mkdir -p /data && chown -R node:node /data /app

USER node
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
