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
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/tsconfig.json ./tsconfig.json

# Run as the non-root `node` user baked into the base image (Phase C).
USER node

EXPOSE 3000

# Apply pending migrations, then exec the HTTP server so Node runs as PID 1
# and receives SIGTERM/SIGINT directly for graceful shutdown.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/server.js"]
