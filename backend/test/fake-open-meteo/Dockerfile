# syntax=docker/dockerfile:1
# Deterministic fake Open-Meteo for e2e (ADR-0012). Zero dependencies.
FROM node:22-alpine
WORKDIR /app
COPY server.mjs ./
EXPOSE 4000
CMD ["node", "server.mjs"]
