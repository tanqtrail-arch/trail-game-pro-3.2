# ── Stage 1: フロントエンドビルド ──
FROM node:20-alpine AS client-build
WORKDIR /build
COPY client/package.json client/package-lock.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ── Stage 2: サーバー ──
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY server/ ./server/
COPY public/ ./public/
COPY migrations/ ./migrations/
COPY --from=client-build /build/dist/ ./public/app/
RUN mkdir -p /app/data
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'node /app/migrations/run.js' >> /app/entrypoint.sh && \
    echo 'exec node /app/server/index.js' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh
EXPOSE 3000
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/trail-game.db
VOLUME ["/app/data"]
ENTRYPOINT ["/app/entrypoint.sh"]
