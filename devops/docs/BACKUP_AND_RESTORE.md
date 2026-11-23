# MySQL backup and restore

Run commands from the repository root. Configuration lives under `devops/`.
The current implementation backs up and restores **MySQL only**. Uploaded files
are not copied or restored. Old snapshots may contain `storage.tar.gz`; the
current restore script ignores that archive.

## Automatic backups

The Compose `backup` service uses `mysql:8.4` and runs
`devops/scripts/backup.sh` once at startup, then daily at 03:00 according to its
effective `BACKUP_TZ` timezone. On failure it retries after five minutes.
The host and Docker must be running; an outage misses that time slot, and the
next service start takes a new backup. The scheduler is in Compose, not host cron.
Check the effective next-run time in the container logs.

Each successful snapshot is stored in the root `backups/TIMESTAMP/` directory,
containing only `mysql.sql.gz`. This host directory is mounted at `/backups`.
The script creates a private temporary directory, takes a transactional SQL dump,
checks gzip readability, then publishes the completed snapshot. After success,
it removes dated snapshot directories older than seven days. It leaves unrelated
directories and incomplete snapshots outside this retention match.
No lock is configured between scheduled and manual runs; avoid overlapping them.

```sh
make backup
bash devops/scripts/restore.sh --check backups/YYYY-MM-DD_HH-MM-SS_UTC
docker compose --env-file .env -f devops/docker-compose.prod.yml logs --tail=50 backup
```

`--check` only verifies the SQL gzip archive. It does not import data or prove that
the application can use the dump. Existing backups stay in their original folder.
They are local copies and do not protect against losing this disk.

## Restore a selected snapshot

Start the stack with a healthy MySQL service and a Backend container, then run:

```sh
make restore BACKUP=backups/YYYY-MM-DD_HH-MM-SS_UTC
```

After archive validation, type `RESTORE` to confirm replacing current database
tables. The script stops Backend if it was running, imports SQL using the MySQL
container's credentials, then starts Backend only after success and only if it
was running before. An import failure leaves Backend stopped.

This discards database changes made after the snapshot. Uploaded files remain
unchanged, so restored database file records may not match the files still on
disk. This is not a complete file-storage recovery procedure. Images, `.env`, TLS
keys, Grafana configuration and Prometheus history are not restored. Check
image/schema compatibility before importing an older snapshot.

The SQL archive check and a database-only restore flow were tested previously;
the database-and-files drills in dated reports describe the older implementation.
Verify login and a real database operation after each actual restore.
