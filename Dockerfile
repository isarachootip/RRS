# ==============================================================================
# RRS Root Dockerfile (All-in-One for Single-Dockerfile Coolify Deployment)
# Supports BOTH domains in one container via host-based gateway on port 3000:
# - rrs.tamadee.online       -> Backoffice Web (:3002)
# - portalrrs.tamadee.online -> Public Portal (:3001)
# - /api/* and /health       -> NestJS Backend API (:4000)
# ==============================================================================
FROM node:22-alpine
RUN apk add --no-cache openssl postgresql postgresql-client postgresql-contrib redis su-exec && \
    corepack enable && corepack prepare pnpm@10.18.0 --activate && \
    mkdir -p /run/postgresql /var/log/postgresql /var/lib/postgresql/data && \
    chown -R postgres:postgres /run/postgresql /var/log/postgresql /var/lib/postgresql/data

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV INTERNAL_API_URL=http://127.0.0.1:4000

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile && \
    pnpm --filter @rrs/db generate && \
    pnpm --filter @rrs/api... build && \
    pnpm --filter @rrs/web... build && \
    pnpm --filter @rrs/portal... build && \
    sed -i 's/\r$//' ./scripts/start-all-in-one.sh && \
    chmod +x ./scripts/start-all-in-one.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV API_PORT=4000
ENV PORTAL_PORT=3001
ENV WEB_PORT=3002

EXPOSE 3000
CMD ["/bin/sh", "/app/scripts/start-all-in-one.sh"]
