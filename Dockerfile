# ==============================================================================
# RRS Root Dockerfile (All-in-One for Single-Dockerfile Coolify Deployment)
# Runs PostgreSQL +pg_trgm/btree_gist + Redis + NestJS API (:4000) + Web (:3000)
# Same-origin proxy: /api/* and /health on port 3000 -> 127.0.0.1:4000
# ==============================================================================
FROM node:22-alpine
RUN apk add --no-cache openssl postgresql postgresql-client postgresql-contrib redis su-exec && \
    corepack enable && corepack prepare pnpm@10.18.0 --activate && \
    mkdir -p /run/postgresql /var/log/postgresql /var/lib/postgresql/data && \
    chown -R postgres:postgres /run/postgresql /var/log/postgresql /var/lib/postgresql/data

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile && \
    pnpm --filter @rrs/db generate && \
    pnpm --filter @rrs/api... build && \
    pnpm --filter @rrs/web... build && \
    sed -i 's/\r$//' ./scripts/start-all-in-one.sh && \
    chmod +x ./scripts/start-all-in-one.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV API_PORT=4000
ENV INTERNAL_API_URL=http://127.0.0.1:4000

EXPOSE 3000
CMD ["/bin/sh", "/app/scripts/start-all-in-one.sh"]
