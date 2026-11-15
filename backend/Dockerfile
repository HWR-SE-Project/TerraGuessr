# syntax=docker/dockerfile:1

# =============================================================================
# TerraGuessr backend — multi-stage build (Node 22, Fastify + Prisma)
# Build context: ./backend
#
# Assumptions (all produced by sibling M0 tasks):
#   * backend/package.json + backend/package-lock.json (F-01, committed)
#   * backend/tsconfig.json with "outDir": "dist" and rootDir "src" (F-01)
#   * backend/src/server.ts is the entry -> dist/server.js (F-01)
#   * backend/prisma/schema.prisma (D-01)
# =============================================================================

# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# Prisma needs OpenSSL for engine download/generation.
RUN apk add --no-cache openssl

# Install all dependencies (includes dev deps: typescript, prisma CLI, ...).
COPY package*.json ./
RUN npm ci

# Generate the Prisma client before compiling (schema owned by data-engineer).
COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apk add --no-cache openssl

# node_modules is copied in full so the prisma CLI is available for the
# migration step below (intentional: image size is traded for correctness).
# src is also needed at runtime: prisma/seed.ts imports from ../src/... and is
# executed via tsx (not the compiled dist/), so it must resolve here too (P0-1).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

# Apply pending migrations, seed the location pool (idempotent — skips once
# the pool is already populated, see prisma/seed.ts), then start the HTTP
# server. DATABASE_URL is supplied by docker compose (from .env).
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/server.js"]
