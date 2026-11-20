# syntax=docker/dockerfile:1

# =============================================================================
# TerraGuessr frontend — Vite build served as static files by nginx.
# Build from the repository root's docker-compose.prod.yml, or:
#   docker build -t terraguessr-frontend \
#     --build-arg VITE_GOOGLE_MAPS_API_KEY=... ./frontend
#
# VITE_* values are baked into the bundle at build time. Rebuild the image
# after changing them.
# =============================================================================

FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=/api
ARG VITE_GOOGLE_MAPS_API_KEY=
ARG VITE_MAP_ATTRIBUTION=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ENV VITE_MAP_ATTRIBUTION=$VITE_MAP_ATTRIBUTION

RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
