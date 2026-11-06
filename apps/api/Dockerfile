# ==============================================================================
# RRS API — Multi-stage Production Dockerfile (Non-root user)
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
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN pnpm --filter @rrs/db generate
RUN pnpm --filter @rrs/api... build

FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate
WORKDIR /app
ENV NODE_ENV=production
USER node

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/apps/api ./apps/api

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

CMD ["sh", "-c", "pnpm --filter @rrs/db migrate:deploy && pnpm --filter @rrs/db seed && node apps/api/dist/main.js"]
