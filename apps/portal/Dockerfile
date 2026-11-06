# ==============================================================================
# RRS Public Portal (portalrrs.tamadee.online) — Production Dockerfile
# ==============================================================================
FROM node:22-alpine
RUN apk add --no-cache openssl && \
    corepack enable && corepack prepare pnpm@10.18.0 --activate

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV INTERNAL_API_URL=https://rrs.tamadee.online

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile && \
    pnpm --filter @rrs/portal... build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["pnpm", "--filter", "@rrs/portal", "start"]
