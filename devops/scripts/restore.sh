#!/usr/bin/env bash
set -euo pipefail

# Locate this project, even when called from another directory.
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
COMPOSE_FILE=${COMPOSE_FILE_PATH:-devops/docker-compose.prod.yml}
if [[ "$COMPOSE_FILE" != /* ]]; then
  COMPOSE_FILE="$ROOT/$COMPOSE_FILE"
fi
COMPOSE=(docker compose -f "$COMPOSE_FILE")
if [[ -f "$ROOT/.env" ]]; then
  COMPOSE+=(--env-file "$ROOT/.env")
fi

# 1. Select the backup. --check validates it without restoring anything.
CHECK_ONLY=false
if [[ "${1:-}" == --check ]]; then
  CHECK_ONLY=true
  shift
fi
if [[ $# -ne 1 ]]; then
  echo 'Usage: restore.sh [--check] backups/TIMESTAMP'
  exit 2
fi
BACKUP_DIR=$(realpath -- "$1")
if [[ "$BACKUP_DIR" != "$ROOT/backups/"* ]]; then
  echo 'Choose a backup inside backups/'
  exit 1
fi

# Validate before stopping anything or changing data.
gzip -t "$BACKUP_DIR/mysql.sql.gz"
echo "MySQL backup OK: $BACKUP_DIR"
if [[ "$CHECK_ONLY" == true ]]; then
  exit 0
fi

# Remember whether Backend needs to be restarted afterward.
BACKEND_CONTAINER=$("${COMPOSE[@]}" ps -aq backend)
BACKEND_WAS_RUNNING=$(docker inspect --format '{{.State.Running}}' "$BACKEND_CONTAINER")

# 2. Ask before replacing data.
echo 'This replaces MySQL tables. Uploaded files will not be restored.'
read -r -p 'Type RESTORE to continue: ' CONFIRM
if [[ "$CONFIRM" != RESTORE ]]; then
  echo 'Cancelled.'
  exit 0
fi

# 3. Stop Backend so it cannot write while we restore.
if [[ "$BACKEND_WAS_RUNNING" == true ]]; then
  "${COMPOSE[@]}" stop backend
fi

# 4. Restore MySQL only.
# On import failure, leave Backend stopped.
echo "[$(date)] Restoring database..."
gzip -dc "$BACKUP_DIR/mysql.sql.gz" | "${COMPOSE[@]}" exec -T mysql sh -c \
  'MYSQL_PWD="${MYSQL_PASSWORD:?}" exec mysql -u"${MYSQL_USER:?}" "${MYSQL_DATABASE:?}"'

# 5. Restart Backend only after success, and only if it was running before.
if [[ "$BACKEND_WAS_RUNNING" == true ]]; then
  "${COMPOSE[@]}" start backend
fi
echo "[$(date)] MySQL restore OK."
