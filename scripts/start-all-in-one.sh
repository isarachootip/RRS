#!/bin/sh
set -e

echo "==> [RRS All-in-One] Starting RRS Platform..."

# 1. Start embedded PostgreSQL if DATABASE_URL is not externally provided
if [ -z "${DATABASE_URL}" ]; then
  echo "==> [RRS All-in-One] Initializing embedded PostgreSQL 16..."
  mkdir -p /run/postgresql /var/lib/postgresql/data
  chown -R postgres:postgres /run/postgresql /var/lib/postgresql/data
  chmod 700 /var/lib/postgresql/data

  if [ ! -f "/var/lib/postgresql/data/PG_VERSION" ]; then
    su-exec postgres initdb -D /var/lib/postgresql/data --encoding=UTF8 --locale=C
  fi

  su-exec postgres pg_ctl -D /var/lib/postgresql/data -l /tmp/postgres.log -w start

  su-exec postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='rrs'" | grep -q 1 || \
    su-exec postgres psql -c "CREATE USER rrs WITH SUPERUSER PASSWORD 'rrs';"
  su-exec postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='rrs'" | grep -q 1 || \
    su-exec postgres psql -c "CREATE DATABASE rrs OWNER rrs;"

  export DATABASE_URL="postgresql://rrs:rrs@127.0.0.1:5432/rrs?schema=public"
fi

# 2. Start embedded Redis if REDIS_URL is not externally provided
if [ -z "${REDIS_URL}" ]; then
  echo "==> [RRS All-in-One] Starting embedded Redis..."
  redis-server --daemonize yes --bind 127.0.0.1 --port 6379
  export REDIS_URL="redis://127.0.0.1:6379"
fi

# 3. Ensure required environment defaults for API & Web
export NODE_ENV="${NODE_ENV:-production}"
export API_PORT="${API_PORT:-4000}"
export PORT="${PORT:-3000}"
export INTERNAL_API_URL="${INTERNAL_API_URL:-http://127.0.0.1:${API_PORT}}"
export JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-rrs-production-jwt-access-secret-key-2026-min32chars}"
export TOTP_ENCRYPTION_KEY="${TOTP_ENCRYPTION_KEY:-MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=}"
export COOKIE_SECURE="${COOKIE_SECURE:-false}"

# 4. Run Prisma database migrations and idempotent initial seed
echo "==> [RRS All-in-One] Running database migrations & initial seed..."
pnpm --filter @rrs/db migrate:deploy
pnpm --filter @rrs/db seed

# 5. Start NestJS Backend API in the background
echo "==> [RRS All-in-One] Starting Backend API on port ${API_PORT}..."
node apps/api/dist/main.js &

# Wait for API healthcheck (up to 20s)
i=0
while [ $i -lt 20 ]; do
  if wget -qO- "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then
    echo "==> [RRS All-in-One] Backend API is healthy!"
    break
  fi
  i=$((i + 1))
  sleep 1
done

# 6. Start Next.js Backoffice Web (proxies /api/* -> INTERNAL_API_URL)
echo "==> [RRS All-in-One] Starting Next.js Web on port ${PORT}..."
exec pnpm --filter @rrs/web start
