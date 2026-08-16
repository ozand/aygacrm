#!/usr/bin/env bash
#
# AygaCRM backup — logical, consistent, and portable.
#
# Produces a timestamped backup under ./backups/<UTC-timestamp>/ containing:
#   - postgres.sql.gz : a gzipped `pg_dump` (schema + data, --clean --if-exists)
#   - minio/          : a full mirror of the object-storage bucket
#
# It talks to the RUNNING compose stack (no downtime). Run from the repo root:
#   ./scripts/backup.sh
#
# Restore with ./scripts/restore.sh <backup-dir>. See docs/deployment/backup.md.
#
# Requires: docker (compose v2). Reads the same .env the stack uses so the
# credentials/bucket match. Safe to schedule from cron/systemd.
set -euo pipefail

cd "$(dirname "$0")/.."

# Load .env if present so POSTGRES_*/S3_* match the running stack.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-aygacrm}"
POSTGRES_DB="${POSTGRES_DB:-aygacrm}"
S3_BUCKET="${S3_BUCKET:-aygacrm}"

TS="$(date -u +%Y%m%d-%H%M%SZ)"
OUT="backups/${TS}"
mkdir -p "${OUT}/minio"

echo "[backup] target: ${OUT}"

# --- PostgreSQL: logical dump (consistent snapshot) ------------------------
echo "[backup] pg_dump ${POSTGRES_DB}..."
docker compose exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists \
  | gzip > "${OUT}/postgres.sql.gz"

# --- MinIO: mirror the bucket into the backup dir --------------------------
# A throwaway mc container joins the compose network, reaches http://minio:9000,
# and mirrors the bucket to /backup (bind-mounted to the host output dir).
echo "[backup] mirror bucket ${S3_BUCKET}..."
docker compose run --rm --no-deps \
  -v "$(pwd)/${OUT}/minio:/backup" \
  --entrypoint /bin/sh minio-init -c '
    set -e
    until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do sleep 1; done
    mc mirror --overwrite --remove "local/${S3_BUCKET}" /backup
  '

# --- Manifest --------------------------------------------------------------
{
  echo "created_utc=${TS}"
  echo "postgres_db=${POSTGRES_DB}"
  echo "s3_bucket=${S3_BUCKET}"
} > "${OUT}/manifest.txt"

echo "[backup] done: ${OUT}"
echo "[backup] restore with: ./scripts/restore.sh ${OUT}"
