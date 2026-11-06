# ==============================================================================
# RRS Public Portal — Multi-stage Production Dockerfile (Non-root user)
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
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY packages/shared ./packages/shared
COPY apps/portal ./apps/portal
RUN pnpm --filter @rrs/portal... build

FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
USER node

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=node:node /app/packages/shared ./packages/shared
COPY --from=builder --chown=node:node /app/apps/portal ./apps/portal

EXPOSE 3001
CMD ["pnpm", "--filter", "@rrs/portal", "start"]
