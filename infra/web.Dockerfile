FROM node:22-bookworm-slim AS build

RUN corepack enable && corepack prepare pnpm@11.1.2 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile && pnpm --filter @koinon/web build

FROM caddy:2.10-alpine

COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
