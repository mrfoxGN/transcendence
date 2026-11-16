# Backup and restore (current Compose setup)

Run these commands from the repository root. This guide describes the current
`backup` service in `docker-compose.prod.yml`, `scripts/backup.sh`, and
`scripts/restore.sh`. It replaces the older host-cron and isolated-restore
instructions recorded in dated progress reports.

## What is saved

The `backup` container uses the `mysql:8.4` image to run `mysqldump` against the
MySQL service. It also reads the `backend_storage` volume at `/storage` in
read-only mode. Each completed snapshot is a directory under the host's
`backups/` directory containing:

- `mysql.sql.gz`: a compressed SQL dump of the application database, including
  its tables and TypeORM migration history.
- `storage.tar.gz`: a compressed archive of uploaded files from `/app/storage`.

The container sees the host's `./backups` directory as `/backups`. That is why
`make backup` prints `/backups/...`, while the corresponding host path is
`backups/...`. This directory is ignored by Git and stays on the local disk
when containers or named volumes are removed. It is **not** included in a
Docker volume and is not an off-machine copy. Protect it because it contains
user data.

The backup does not include `.env`, TLS keys, Docker images, Grafana settings,
or Prometheus history. Keep the required configuration and images separately.

## When the automatic backup runs

`make up` starts the `backup` service after `migrate` completes. The service
creates one backup when it starts, then sleeps until the next 03:00 in its
configured timezone (`BACKUP_TZ`, default `Africa/Casablanca`). It repeats
once per day while the host, Docker and service remain running. If a backup
fails, it retries after five minutes. `restart: unless-stopped` restarts the
service after an unexpected stop or Docker restart; its startup backup then
runs again. If the machine is off at 03:00, there is no backup at that time;
the next service start creates one.

Check that the service is running and read its output with:

```bash
docker compose -f docker-compose.prod.yml ps backup
docker compose -f docker-compose.prod.yml logs --tail=50 backup
```

The current script does **not** implement automatic retention, backup-failure
notifications, or a lock between a manual and scheduled backup. Avoid running
`make backup` during deployment or another backup. It verifies archive
readability with `gzip -t` and `tar -tzf`; it does not create SHA256SUMS.
Review local disk space and remove old snapshots deliberately after deciding
what recovery points to keep.

The previous host `crontab` entry pointing to the old checkout is not part of
this setup. If it still exists, remove only that project's managed cron block
with `crontab -e` to avoid duplicate jobs. A fresh clone needs no host cron
configuration for this Compose backup service.

## Create and verify a backup manually

```bash
make backup
bash scripts/restore.sh --check backups/YYYY-MM-DD_HH-MM-SS_UTC
```

Replace the example directory with the timestamp printed by `make backup`,
but use the host path `backups/...` rather than `/backups/...`. The `--check`
command checks both archives without changing MySQL or uploaded files. It does
not prove that the application can use the restored data; perform a restore
exercise as well.

`mysqldump --single-transaction` takes a consistent database snapshot for
transactional tables. File archiving happens separately while Backend can
still write. Therefore a database record and a concurrently changed uploaded
file are not guaranteed to represent the exact same instant. Schedule backups
at a quiet time and test important uploads during recovery exercises.

## Restore a selected snapshot into the current stack

The stack must already be running with a healthy MySQL service, a Backend
container, and its storage volume. Select the intended snapshot explicitly:

```bash
make restore BACKUP=backups/YYYY-MM-DD_HH-MM-SS_UTC
```

The script first checks the two archives. It then asks you to type `RESTORE`.
After confirmation it stops Backend, imports SQL into the configured MySQL
database, extracts uploaded files into the Backend storage volume, and starts
Backend again if it was running before. It does not restore Docker images,
`.env`, or TLS certificates. A failed import leaves Backend stopped so it does
not serve partially restored data.

This operation changes the **current** database. SQL import can replace tables
and discard writes made after the selected snapshot. Storage extraction
replaces files with matching names but does **not** delete extra files that
were created after the snapshot. Preserve current data before an incident
restore and verify records, login, uploads and application health afterward.
The script does not check image/schema compatibility, so use a compatible
Backend image and review migration changes before restoring an older snapshot.

## Local data-loss exercise performed on 2026-11-16

1. Created an application user and confirmed the account was present.
2. Ran `make backup`; it produced `backups/2026-11-16_11-00-14_UTC`.
3. Ran `bash scripts/restore.sh --check` on that snapshot; both archives passed.
4. Stopped the stack using `docker compose -f docker-compose.prod.yml down`.
5. Removed only `transcendence-prod_mysql_data` and
   `transcendence-prod_backend_storage`. Grafana and Prometheus volumes stayed.
6. Ran `make up`, observed the user was absent, then restored the selected
   snapshot with `scripts/restore.sh`. The user reported that restore worked.

The exercise confirmed recovery of the user record in this local setup.
Restoration of a real uploaded file and an actual 03:00 scheduled run were not
observed in this exercise. The `make restore` target was added afterward and
verified by a dry run; it calls the same script used for the successful restore.

Do not repeat the destructive volume-removal steps on valuable data just to
check a backup. The backup directory survives `docker compose down` and
removal of the two named data volumes, but will be lost if this local disk or
project directory is lost. See [Disaster recovery](DISASTER_RECOVERY.md).
