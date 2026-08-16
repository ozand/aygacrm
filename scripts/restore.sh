#!/usr/bin/env bash
#
# AygaCRM restore — restores a backup produced by scripts/backup.sh into the
# RUNNING compose stack. DESTRUCTIVE: it overwrites the current database and
# object storage with the backup's contents.
#
#   ./scripts/restore.sh backups/<UTC-timestamp>
#
# See docs/deployment/backup.md.
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="${1:-}"
if [ -z "${SRC}" ] || [ ! -d "${SRC}" ]; then
  echo "usage: $0 <backup-dir>   (e.g. $0 backups/20260817-120000Z)" >&2
  exit 1
fi
if [ ! -f "${SRC}/postgres.sql.gz" ]; then
  echo "ERROR: ${SRC}/postgres.sql.gz not found — not a valid backup dir." >&2
  exit 1
fi

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-aygacrm}"
POSTGRES_DB="${POSTGRES_DB:-aygacrm}"
S3_BUCKET="${S3_BUCKET:-aygacrm}"

echo "WARNING: this OVERWRITES the current database '${POSTGRES_DB}' and bucket"
echo "         '${S3_BUCKET}' with the backup at: ${SRC}"
printf "Type 'yes' to continue: "
read -r CONFIRM
[ "${CONFIRM}" = "yes" ] || { echo "aborted."; exit 0; }

# --- PostgreSQL ------------------------------------------------------------
echo "[restore] loading postgres dump..."
gunzip -c "${SRC}/postgres.sql.gz" \
  | docker compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

# --- MinIO -----------------------------------------------------------------
if [ -d "${SRC}/minio" ]; then
  echo "[restore] mirroring objects back into bucket ${S3_BUCKET}..."
  docker compose run --rm --no-deps \
    -v "$(pwd)/${SRC}/minio:/backup" \
    --entrypoint /bin/sh minio-init -c '
      set -e
      until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do sleep 1; done
      mc mb --ignore-existing "local/${S3_BUCKET}"
      mc mirror --overwrite --remove /backup "local/${S3_BUCKET}"
    '
fi

echo "[restore] done. Restart the app if it was running: docker compose restart app"
