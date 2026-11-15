# syntax=docker/dockerfile:1

# =============================================================================
# TerraGuessr frontend — multi-stage build (Node 22 -> nginx)
# Build context: repository root (so the root nginx.conf can be copied).
# =============================================================================

# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# Vite reads these at build time (architecture.md §10 / R19). Defaults mirror
# .env.example; docker compose passes the values from .env as build args.
ARG VITE_API_BASE_URL=/api
ARG VITE_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
ARG VITE_MAP_ATTRIBUTION="© OpenStreetMap contributors · © Open-Meteo"

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_TILE_URL=$VITE_TILE_URL
ENV VITE_MAP_ATTRIBUTION=$VITE_MAP_ATTRIBUTION

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# ---- Serve stage ----
FROM nginx:1.27-alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
