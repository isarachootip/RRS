#!/bin/sh

echo "==> [RRS All-in-One] Starting RRS Platform..."

USE_EMBEDDED_PG=0
if [ -z "${DATABASE_URL}" ]; then
  USE_EMBEDDED_PG=1
else
  PSQL_CHECK_URL=$(echo "${DATABASE_URL}" | sed 's/[?&]schema=[^&]*//g')
  echo "==> [RRS All-in-One] Testing connection to external DATABASE_URL..."
  if su-exec postgres psql "${PSQL_CHECK_URL}" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "==> [RRS All-in-One] External PostgreSQL connected successfully!"
    su-exec postgres psql "${PSQL_CHECK_URL}" -c 'CREATE EXTENSION IF NOT EXISTS "btree_gist"; CREATE EXTENSION IF NOT EXISTS "pg_trgm";' || true
  else
    echo "==> [RRS All-in-One] WARN: Cannot reach external DATABASE_URL (check Coolify 'Connect to Predefined Network'). Falling back to persistent /var/lib/postgresql/data..."
    USE_EMBEDDED_PG=1
  fi
fi

# 1. Start embedded PostgreSQL if DATABASE_URL is not provided or unreachable
if [ "${USE_EMBEDDED_PG}" = "1" ]; then
  echo "==> [RRS All-in-One] Initializing persistent PostgreSQL on /var/lib/postgresql/data..."
  PGDATA="/var/lib/postgresql/data/pgdata"
  mkdir -p /run/postgresql /var/log/postgresql "${PGDATA}"
  chown -R postgres:postgres /run/postgresql /var/log/postgresql /var/lib/postgresql/data
  chmod 700 "${PGDATA}"

  if [ ! -f "${PGDATA}/PG_VERSION" ]; then
    su-exec postgres initdb -D "${PGDATA}" --encoding=UTF8 --locale=C --auth=trust --username=rrs
  fi

  rm -f "${PGDATA}/postmaster.pid"
  su-exec postgres pg_ctl -D "${PGDATA}" -l /var/log/postgresql/postgres.log -o "-c listen_addresses=127.0.0.1 -p 5432 -k /run/postgresql" -w start

  su-exec postgres psql -h 127.0.0.1 -U rrs -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='rrs'" | grep -q 1 || \
    su-exec postgres psql -h 127.0.0.1 -U rrs -d postgres -c "CREATE DATABASE rrs OWNER rrs;"

  su-exec postgres psql -h 127.0.0.1 -U rrs -d rrs -c 'CREATE EXTENSION IF NOT EXISTS "btree_gist"; CREATE EXTENSION IF NOT EXISTS "pg_trgm";' || true

  export DATABASE_URL="postgresql://rrs:rrs@127.0.0.1:5432/rrs?schema=public"
fi

# 2. Start embedded Redis if REDIS_URL is not externally provided
if [ -z "${REDIS_URL}" ]; then
  echo "==> [RRS All-in-One] Starting embedded Redis..."
  redis-server --daemonize yes --bind 127.0.0.1 --port 6379 || true
  export REDIS_URL="redis://127.0.0.1:6379"
fi

# 3. Ensure required environment defaults for API, Web, and Portal
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"
export API_PORT="${API_PORT:-4000}"
export PORTAL_PORT="${PORTAL_PORT:-3001}"
export WEB_PORT="${WEB_PORT:-3002}"
export INTERNAL_API_URL="${INTERNAL_API_URL:-http://127.0.0.1:${API_PORT}}"
export JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-rrs-production-jwt-access-secret-key-2026-min32chars}"
export TOTP_ENCRYPTION_KEY="${TOTP_ENCRYPTION_KEY:-MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=}"
export COOKIE_SECURE="${COOKIE_SECURE:-false}"
export UPLOAD_DIR="${UPLOAD_DIR:-/var/lib/postgresql/data/uploads}"
mkdir -p "${UPLOAD_DIR}"

# 4. Run Prisma database migrations and idempotent initial seed
echo "==> [RRS All-in-One] Running database migrations & initial seed..."
pnpm --filter @rrs/db migrate:deploy || echo "WARN: migrate:deploy had issues"
pnpm --filter @rrs/db seed || echo "WARN: seed had issues"

# 5. Start NestJS Backend API (:4000), Public Portal (:3001), and Backoffice Web (:3002)
echo "==> [RRS All-in-One] Starting Backend API on :${API_PORT}..."
node apps/api/dist/main.js &

echo "==> [RRS All-in-One] Starting Public Portal on :${PORTAL_PORT}..."
PORT="${PORTAL_PORT}" pnpm --filter @rrs/portal start &

echo "==> [RRS All-in-One] Starting Backoffice Web on :${WEB_PORT}..."
PORT="${WEB_PORT}" pnpm --filter @rrs/web start &

# 6. Start Host-based Gateway on 0.0.0.0:${PORT} (3000)
echo "==> [RRS All-in-One] Starting Gateway on 0.0.0.0:${PORT}..."
exec node /app/scripts/gateway.mjs
