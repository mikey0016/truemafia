# syntax=docker/dockerfile:1

# node:sqlite requires Node >= 24 (unflagged & stable); Node 22 needs --experimental-sqlite
FROM node:24-alpine

# Install fly.io-friendly init for proper signal handling
RUN apk add --no-cache curl

WORKDIR /app

# Install ALL workspace deps (dev deps needed for tsc/vite/tsx during build).
# NOTE: NODE_ENV=production is set AFTER the build, otherwise npm skips devDependencies.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --include=dev

# Copy sources
COPY tsconfig.base.json ./
COPY shared shared/
COPY server server/
COPY client client/

# Build shared types + client bundle
RUN npm run build

# Production env from here on (deps are already installed with dev included)
ENV NODE_ENV=production

WORKDIR /app/server

# SQLite volume papkasi (Fly.io / Docker)
RUN mkdir -p /data

# Local/Docker fallback: SQLite fayli shu papkada yashaydi.
# Render'da DB_CLIENT=postgres + DATABASE_URL env orqali beriladi.
ENV DATABASE_URL=/data/true-mafia.sqlite

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD curl -fsS http://localhost:3000/api/health || exit 1

CMD ["npx", "tsx", "src/index.ts"]
