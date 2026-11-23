#!/usr/bin/env bash
set -euo pipefail
# Only the backup owner can read newly created files.
umask 077

BACKUP_DIR="/backups"
TIMESTAMP=$(date -u +%Y-%m-%d_%H-%M-%S_UTC)
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"
RETENTION_DAYS=7
FILE_OWNER=$(stat -c '%u:%g' /scripts/backup.sh)

# 1. Prepare a private folder for this backup.
chown "$FILE_OWNER" "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
if [[ -e "$BACKUP_PATH" ]]; then
  echo 'Backup already exists'
  exit 1
fi
WORK_DIR=$(mktemp -d "$BACKUP_DIR/.partial-XXXXXX")
# Remove the unfinished folder if a command fails.
trap 'rm -rf -- "$WORK_DIR"' EXIT

echo "[$(date)] Starting backup..."
# 2. Save MySQL as compressed SQL.
mysqldump -h "$DB_HOST" -u "$DB_USER" --single-transaction --quick \
  --no-tablespaces --routines --triggers --events "$DB_NAME" | gzip > "$WORK_DIR/mysql.sql.gz"

# 3. Check the SQL archive, then mark the backup as complete.
gzip -t "$WORK_DIR/mysql.sql.gz"
chown -R "$FILE_OWNER" "$WORK_DIR"
mv -T -- "$WORK_DIR" "$BACKUP_PATH"
echo "[$(date)] Backup saved: $BACKUP_PATH"

# 4. Delete snapshots older than seven days, only after a successful backup.
# Ignore unfinished backups and directories such as local-recovery.
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d \
  -name '20??-??-??_??-??-??_UTC' -mmin +$((RETENTION_DAYS * 1440)) \
  -exec rm -rf -- {} +
echo "[$(date)] Done. Backups older than $RETENTION_DAYS days removed."
