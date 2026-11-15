#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE_PATH:-docker-compose.prod.yml}"
[[ "$COMPOSE_FILE" = /* ]] || COMPOSE_FILE="$PROJECT_ROOT/$COMPOSE_FILE"
[[ -f "$COMPOSE_FILE" ]] || { echo "Missing Compose file: $COMPOSE_FILE" >&2; exit 1; }
COMPOSE=(docker compose -f "$COMPOSE_FILE")

umask 077
BACKUP_ROOT="$PROJECT_ROOT/backups"
mkdir -p -- "$BACKUP_ROOT"
chmod 700 -- "$BACKUP_ROOT"
STAMP="$(date -u +%Y-%m-%d_%H-%M-%S_UTC)"
DEST="$BACKUP_ROOT/$STAMP"
[[ ! -e "$DEST" ]] || { echo "Backup already exists: $DEST" >&2; exit 1; }
TMP="$(mktemp -d "$BACKUP_ROOT/.partial-${STAMP}-XXXXXX")"
trap 'if [[ -d "$TMP" ]]; then rm -rf -- "$TMP"; fi' EXIT

BACKEND_ID="$("${COMPOSE[@]}" ps -q backend)"
[[ -n "$BACKEND_ID" ]] || { echo "Backend container not running/found" >&2; exit 1; }
STORAGE_VOL="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/storage"}}{{.Name}}{{end}}{{end}}' "$BACKEND_ID")"
[[ -n "$STORAGE_VOL" ]] || { echo "No named volume at /app/storage" >&2; exit 1; }
docker volume inspect "$STORAGE_VOL" >/dev/null

# Database: consistent transactional dump for InnoDB; compressed on the host.
"${COMPOSE[@]}" exec -T mysql sh -c \
  'MYSQL_PWD="${MYSQL_PASSWORD:?MYSQL_PASSWORD missing}" exec mysqldump \
   -u"${MYSQL_USER:?MYSQL_USER missing}" --single-transaction --quick \
   --no-tablespaces --routines --triggers --events "${MYSQL_DATABASE:?MYSQL_DATABASE missing}"' \
  | gzip -c > "$TMP/mysql.sql.gz"

# Uploaded files: read-only mount of the backend's named volume.
docker run --rm --network none \
  --mount "type=volume,source=${STORAGE_VOL},target=/data,readonly" \
  alpine:3.22 tar -czf - -C /data . > "$TMP/storage.tar.gz"

# Check that both archives can be read before publishing the backup.
gzip -t "$TMP/mysql.sql.gz"
tar -tzf "$TMP/storage.tar.gz" >/dev/null
chmod 600 "$TMP/mysql.sql.gz" "$TMP/storage.tar.gz"
mv -T -- "$TMP" "$DEST"
printf 'Backup OK: %s\n' "$DEST"
ls -lh -- "$DEST/mysql.sql.gz" "$DEST/storage.tar.gz"
