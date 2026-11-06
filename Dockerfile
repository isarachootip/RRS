# ==============================================================================
# RRS Root Dockerfile (All-in-One for Single-Dockerfile Coolify Deployment)
# Runs PostgreSQL 16 + Redis + NestJS API (:4000) + Next.js Web (:3000)
# Same-origin proxy: /api/* and /health on port 3000 -> 127.0.0.1:4000
# ==============================================================================
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/commission/package.json ./packages/commission/
COPY packages/db/package.json ./packages/db/prisma.config.ts ./packages/db/
COPY packages/db/prisma ./packages/db/prisma
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/portal/package.json ./apps/portal/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY packages ./packages
COPY apps ./apps
RUN pnpm --filter @rrs/db generate
RUN pnpm --filter @rrs/api... build && pnpm --filter @rrs/web... build

FROM node:22-alpine AS runner
RUN apk add --no-cache postgresql16 redis su-exec && \
    corepack enable && corepack prepare pnpm@10.18.0 --activate && \
    mkdir -p /run/postgresql /var/lib/postgresql/data && \
    chown -R postgres:postgres /run/postgresql /var/lib/postgresql/data
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV API_PORT=4000
ENV INTERNAL_API_URL=http://127.0.0.1:4000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/apps/web ./apps/web
COPY scripts/start-all-in-one.sh ./scripts/start-all-in-one.sh
RUN sed -i 's/\r$//' ./scripts/start-all-in-one.sh && chmod +x ./scripts/start-all-in-one.sh

VOLUME ["/var/lib/postgresql/data"]
EXPOSE 3000
CMD ["/bin/sh", "/app/scripts/start-all-in-one.sh"]
