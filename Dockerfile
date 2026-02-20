FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --production

# Copy application
COPY server/ ./server/
COPY public/ ./public/
COPY migrations/ ./migrations/

# Create data directory
RUN mkdir -p /app/data

# Run migrations on startup
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'node /app/migrations/run.js' >> /app/entrypoint.sh && \
    echo 'exec node /app/server/index.js' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

EXPOSE 3000

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/trail-game.db

VOLUME ["/app/data"]

ENTRYPOINT ["/app/entrypoint.sh"]
