# Disaster recovery (current local setup)

This runbook matches the current Compose backup service and restore script.
Work from the repository root. Dated drill reports describe older implementations
and should not be used as commands for the current checkout.

## Recovery material and limits

A recoverable application snapshot is one timestamped directory in `backups/`
with `mysql.sql.gz` and `storage.tar.gz`. The directory is on the same local
disk as the project. It survives removal of Docker containers and named data
volumes, but it does not protect against loss of this disk or machine. No
external or off-machine copy is configured. Keep `.env`, TLS keys, the source
repository, and a compatible Backend image available separately.

The backup service runs at startup and then daily at 03:00 in `BACKUP_TZ`
(default `Africa/Casablanca`) while it is running. It retries failures after
five minutes. It has no automatic retention or external notification. The
recovery point is the most recent **verified** snapshot, not necessarily the
last scheduled time. Check the directory timestamp and archive integrity.

A database restore affects the live stack, and changes since the selected
snapshot may be lost. The storage archive is extracted over the existing
volume; files absent from the snapshot are not removed. MySQL system accounts,
Grafana/Prometheus history, `.env`, TLS keys, and Docker images are not in the
application backup.

## First response

1. Identify the failed component with `make status` and relevant
   `docker compose -f docker-compose.prod.yml logs --tail=100 SERVICE` output.
2. Preserve the current volumes and any useful logs. Avoid `down -v`, volume
   removal, or a broad Docker prune while investigating.
3. List available snapshot directories under `backups/` and select the
   intended recovery time. Do not choose a new empty startup snapshot by
   accident. Keep a copy of the current data before overwriting it.
4. Verify the selected snapshot:

```bash
bash scripts/restore.sh --check backups/YYYY-MM-DD_HH-MM-SS_UTC
```

This checks gzip/tar readability. It does not check image compatibility or
prove the application will work after import.

## If only a container failed

If data volumes are intact, restart the affected service. For Backend use
`make restart`, then verify HTTPS and a database-dependent action such as login.
Do not restore old data just because a container stopped; persistent volumes
should survive container replacement.

## If MySQL data or uploaded files were lost

1. Preserve any surviving data and choose the snapshot. Explain that changes
   after its timestamp will not be in the restored database.
2. Confirm `.env` credentials and the compatible Backend image are available.
   Start the stack with `make up` if the lost volumes were recreated. This runs
   migrations on the fresh MySQL volume and may create a new, empty backup;
   **keep using the older selected snapshot**.
3. Run the guarded restore:

```bash
make restore BACKUP=backups/YYYY-MM-DD_HH-MM-SS_UTC
```

4. Read the warning and type `RESTORE` only after checking the selected path.
   The script stops Backend, imports MySQL, extracts storage and restarts
   Backend on success. If it fails, leave Backend stopped and inspect the error
   before retrying.
5. Verify the expected user can log in, relevant records are present, uploaded
   files can be opened, `/health` responds through HTTPS, and logs are clean.
   A successful import alone does not prove complete recovery.

This is an **in-place restore** into the current Compose stack. The current
script does not create an isolated recovery project or safely promote tested
volumes. For an incident involving valuable production data, rehearse on a
separate clone/stack first and plan the cutover explicitly.

## If the whole disk or machine was lost

The current local-only `backups/` directory is lost with that disk. Recovery
then requires a separate copy of the snapshot and private configuration, plus
compatible images or the ability to rebuild them. No such off-machine copy is
configured here, so complete machine-loss recovery is not currently guaranteed.

## Evidence from the local exercise

On 2026-11-16, a user was created, a snapshot was made and archive-checked,
the MySQL and Backend storage volumes were removed, and the stack was started
with empty application data. The selected snapshot was restored and the user
reported that the account returned. This did not test recovery of a real
uploaded file, a whole-machine loss, or the 03:00 scheduled execution. See
[Backup and restore](BACKUP_AND_RESTORE.md) for the exact workflow.
