# PPIC Alter-S — production image
# Node 22 + Python 3 (the deterministic compute script is invoked via `python3`).
FROM node:22-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The lockfile is in sync again as of PR #3, so use a reproducible install.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Runtime dirs (also mounted as volumes in docker-compose.yml)
RUN mkdir -p logs .codebuddy-sdk

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server/index.js"]
