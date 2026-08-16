# Data persistence & backup

AygaCRM is local-first: your data must be durable and portable, and losing it
must not depend on anyone remembering a flag. This page describes where data
lives and how to back it up / restore it.

## Where data lives

The compose stack keeps **all** persistent state in **host bind-mounts** under
`${DATA_DIR:-./data}` — deliberately NOT Docker named volumes:

| Path | Contents |
|---|---|
| `${DATA_DIR}/postgres` | The PostgreSQL database (contacts, golden records, provenance, auth). |
| `${DATA_DIR}/minio` | Uploaded files and avatars (the MinIO object store). |

Because these are host directories, data survives every routine operation —
including the destructive ones that wipe named volumes:

| Operation | Data? |
|---|---|
| `docker compose down` | ✅ kept |
| `docker compose down -v` | ✅ kept (bind-mounts ignore `-v`) |
| `docker volume prune` | ✅ kept (nothing to prune) |
| image update / rebuild / `rm` | ✅ kept |
| deleting the `${DATA_DIR}` directory | ❌ gone — this is the only way to lose it |

**Production:** set `DATA_DIR` to a dedicated, backed-up disk path in your
`.env`, e.g. `DATA_DIR=/srv/aygacrm/data`. The default `./data` is fine for a
laptop but ties data to the checkout directory.

`data/` and `backups/` are gitignored — never committed.

## Backup

`scripts/backup.sh` produces a timestamped, consistent, downtime-free backup
against the running stack:

```bash
./scripts/backup.sh
# -> backups/<UTC-timestamp>/
#      postgres.sql.gz   (gzipped pg_dump, --clean --if-exists)
#      minio/            (full mirror of the object bucket)
#      manifest.txt
```

It uses a logical `pg_dump` (portable across Postgres minor versions and
machines) and mirrors the MinIO bucket via a throwaway `mc` container. Move the
resulting directory off-box (rsync, object storage, etc.) for real safety —
a backup on the same disk is not a backup.

### Scheduling

Run it from the host scheduler. Example nightly cron (host crontab):

```cron
15 3 * * *  cd /srv/aygacrm && ./scripts/backup.sh >> /var/log/aygacrm-backup.log 2>&1
```

Or a systemd timer. Prune old backups with a companion `find backups -maxdepth 1
-type d -mtime +30 -exec rm -rf {} +` step if you want retention.

## Restore

`scripts/restore.sh` loads a backup back into the running stack. It is
**destructive** — it overwrites the current DB and bucket — and asks for
confirmation:

```bash
./scripts/restore.sh backups/20260817-030015Z
docker compose restart app   # if it was already running
```

## Disaster recovery (fresh host)

1. Clone the repo, set `.env` (same `POSTGRES_*` / `S3_*` credentials).
2. `docker compose up -d` (creates empty `${DATA_DIR}`).
3. `./scripts/restore.sh <backup-dir>`.

Alternatively, since the data is plain files, you can also recover by copying a
whole `${DATA_DIR}` tree from a filesystem-level backup of the old host — but
the logical `backup.sh` dumps are the portable, version-independent path and are
preferred.
