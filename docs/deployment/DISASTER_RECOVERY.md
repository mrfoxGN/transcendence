# Disaster recovery

This guide covers local infrastructure incidents. Read the incident-specific
steps before acting; do not run all sections as one procedure. Production
recovery and volume cutover require an agreed maintenance window and explicit
selection of the backup and data-loss cutoff. Application defects belong to the
backend team; no application source changes are required by these procedures.

## What a recoverable installation needs

Keep the following together as a protected recovery set, with secrets stored
securely and never committed or printed:

- A completed paired backup directory: database.sql.gz, files.tar.gz, image-ID
  records and SHA256SUMS. SQL and files must come from the same snapshot.
- The exact Backend and MySQL images recorded in that backup. Retain/preserve
  actual image archives or accessible immutable registry references. A tag or
  image ID alone cannot recreate an image after disk loss.
- The repository plus local DevOps files not yet committed, including Compose,
  Dockerfiles, scripts, Nginx and monitoring configuration.
- Private .env, especially encryption keys for encrypted GitHub tokens, database
  credentials and Grafana's secret key. Losing the token encryption key may make
  stored tokens unusable even after a successful SQL restore.
- TLS keys/certificates, or a documented replacement and local trust procedure.
- If Grafana users/settings and Prometheus history must survive, back up their
  volumes separately. Current application backups do not include them; dashboard
  provisioning can recreate dashboards but not historical metrics or all UI state.

Backup integrity checks detect corruption, not malicious tampering. Restore only
trusted archives created by this project's process.

## Recovery limits

The schedule is daily at 03:00 system time while the host and Docker are running.
Cron does not catch up missed runs. Data loss is measured from the last verified
successful snapshot, not simply "at most 24 hours". A missed run or disconnected
external drive increases that gap. Record the actual snapshot time before use.

Recovery time includes finding images/secrets, preparing a replacement host,
copying data, import and validation. A small local drill is not a guaranteed
recovery-time objective for a real incident.

## First response

1. Identify whether the failure is the application, MySQL, storage, Nginx or the
   host. Use `make status`, https://localhost/status and Grafana where available.
   Unknown means no recent evidence, not confirmed service failure.
2. Preserve logs and current volumes. Do not run Docker prune, `down --volumes`,
   delete MySQL files, or overwrite the existing backup to attempt a repair.
3. Record running image IDs, volume names, the last successful backup and the
   suspected start time. Restrict incident logs because they may contain data.
4. Coordinate ongoing writes and the automatic backup schedule. Disable only
   the managed backup cron block during a recovery/cutover window, record it,
   and re-enable it afterward. Do not replace unrelated cron jobs.
5. Choose the relevant branch below. Get the owner's agreement before accepting
   snapshot-related data loss or replacing Production volumes.

## A. Container failure with intact data

Check relevant logs and health first. If Backend alone has stopped and the
configured image/schema is still correct, `make restart` restarts Backend,
waits for readiness and reloads Nginx. It does not repair application bugs.
For MySQL, inspect logs and available disk space before starting the existing
container; preserve its volume. Do not initialize an empty replacement merely
because the container stopped. After a MySQL incident verify a real database
query from Backend in addition to /health.

For Nginx, validate its config and TLS files before restarting. For a monitoring
failure, recover the relevant service and confirm recent samples; absence of
alerts alone is not proof of recovery.

## B. Bad release

Use [Release and rollback](RELEASE_AND_ROLLBACK.md). Select the retained previous
image only when it supports the current schema. Do not assume MySQL DDL rolled
back after a migration error. A forward fix may be safer than restoring older
data. Image rollback does not restore deleted rows/files or undo migrations.

## C. Lost/corrupted database or uploaded files

1. Stop writes in an agreed maintenance window; preserve the damaged volumes
   for investigation. Do not overwrite them during the first restore attempt.
2. Select the last appropriate trusted paired snapshot. Confirm its timestamp
   and explain which subsequent changes will not be present.
3. Ensure the exact images and required secrets are available. Check SHA256SUMS
   inside that backup directory; check gzip/tar integrity as well.
4. Use the existing guarded script to restore into a **new** isolated project:

```bash
BACKEND_IMAGE=YOUR_MATCHING_BACKEND_IMAGE bash scripts/restore-test.sh \
  backups/YOUR_COMPLETED_BACKUP transcendence-restore-incident-UNIQUE
```

Replace every placeholder, using a lowercase unique project suffix. The script
rejects the Production name, existing target resources and image mismatches.
It uses current .env database credentials for the new MySQL instance. A failed
restore leaves isolated resources for inspection, rather than overwriting them.

5. Verify real expected records, migration state, Backend health, and physical
   file contents/hashes against their metadata. A successful SQL import and an
   empty users query do not prove every feature or file was recovered.
6. Keep Production stopped until the restored dataset and data-loss cutoff are
   approved. An isolated restore is not yet a Production cutover.

## Controlled cutover to validated restored volumes

This is a documented operator plan, **not executed or fully rehearsed** by the
local restore drills. Stop and review exact resource names before each change.

1. Record both original Production volume names and the validated restore's
   mysql_data/backend_storage volume names with Docker inspect. Retain the old
   volumes; make no destructive cleanup part of cutover.
2. Stop Backend/MySQL in both projects. A MySQL data volume must never be mounted
   by two running MySQL servers. Confirm all four containers are stopped.
3. Persistently change only the two top-level volume definitions in Production
   Compose to reference the validated volumes explicitly, for example:

```yaml
volumes:
  mysql_data:
    external: true
    name: VERIFIED_RESTORED_MYSQL_VOLUME
  backend_storage:
    external: true
    name: VERIFIED_RESTORED_STORAGE_VOLUME
```

Preserve all other volume definitions. This must be a durable configuration
change used by Makefile, backup scripts and future Compose commands, not a
one-time override that later commands silently omit. Keep a copy of the previous
configuration. `external: true` makes Compose fail if the selected volume is
missing instead of silently creating an empty one. Re-check names using
`docker volume inspect`; this sample is not runnable with placeholders.

4. Select the matching Backend image in .env. Keep the credentials used for the
   restored MySQL instance; changing MYSQL_PASSWORD does not reset a password
   already stored in an initialized volume. Preserve application encryption keys.
5. Validate Compose. Start Production MySQL using the selected volume and wait
   for health, run the matching migrations and require success, then start
   Backend and wait for health. Do not build a different image during recovery.
6. Recreate the USAGE-only monitoring account with
   `python3 scripts/setup-mysql-monitoring.py` on the recovered Production MySQL,
   because application dumps exclude MySQL system accounts. Verify exporter
   connectivity; restart it if needed.
7. Reload Nginx after checking its config, verify HTTPS, real authorized
   login/profile/workspace operations and upload/download/delete behavior,
   then check fresh Status page/Grafana readings. Restore remaining services.
8. Record the selected image/volumes, restore point and verification results;
   restore the backup schedule. Take and verify a new paired backup only after
   accepting the recovered state. Do not delete old volumes until their owner
   approves their disposal.

Do not use the test-cleanup `down --volumes` command on the restore project once
its volumes have been adopted by Production. A cutover reversal also requires
stopping both databases and considering any new writes; it is not automatic.

## D. Entire machine lost

A local-only backup cannot cover this event. On a replacement host, obtain the
protected external recovery set, install Docker/Compose, restore the repository
and private environment/TLS configuration, and load/verify the exact images.
Start with the isolated restore procedure and validation, then plan the controlled
cutover. Re-establish local certificate trust as needed. Re-provision monitoring
and verify fresh metrics; do not mistake empty monitoring history for recovered
historical data. Without an external recovery set, record what is missing rather
than promise complete recovery.

## External copy: USB / external drive

The user initially selected USB, then explicitly chose a local-disk copy because
no external drive is available (2026-11-08). External export is deferred; no
external copy or automatic USB export is configured or tested.

When available:

1. Confirm the actual mounted external device/path and available space. Do not
   format it or assume an ordinary local directory is an external backup.
2. Copy a completed checksum-valid paired backup plus the protected recovery
   prerequisites above. Use encrypted storage or an encrypted recovery archive
   with a passphrase held separately. Do not rely on Unix permissions on FAT/exFAT
   to protect credentials and user data.
3. Verify the copied archive checksums on the external device and rehearse
   recovery from that copy. Protecting only the SQL dump is insufficient.
4. Safely eject/disconnect the device and store it separately. Refresh copies
   regularly; local seven-backup retention does not manage external retention.
   Choose the external retention/copy schedule when the device is available.

## Drill evidence

See the dated progress report for the actual isolated data-loss/restore test.
It creates synthetic data only. This validates database/file backup mechanisms
and the guarded restore script, not real application upload authorization,
complete Production cutover, external-drive recovery or total host replacement.


### Completed drill — 2026-11-08

Created a fresh isolated MySQL/migrate/Backend stack using the current release.
Seeded a synthetic metadata table and two real storage files: a 52-byte text
file and a 1,048,576-byte binary file. Stopped only the test Backend, created a
paired mysqldump/tar snapshot with image IDs and checksums, then removed the
source stack and both source volumes to simulate data loss.

The existing restore script recovered that snapshot into a second isolated
stack. Both file contents matched their original SHA-256 hashes and lengths,
and the recovered metadata matched the expected records. Database access,
migration state and Backend health passed. Restore plus verification took
33 seconds with locally available images and a tiny dataset; this is not an
incident RTO promise. All original Production container IDs/start times stayed
unchanged. Removed both test stacks, volumes/networks and the synthetic snapshot.

The drill exercised the same dump/archive format but did not invoke the
Production backup scheduler or use real user uploads. The full application
upload/download route and Production volume cutover were not tested here.


## Local recovery copy — 2026-11-08

At the user's request, copied the latest checksum-valid completed backup into
`backups/local-recovery/20261107T114102Z-peIeih/`. Verified every copied file
against its source and the copied SHA256SUMS. Directory permissions are 700,
files 600; the existing backups ignore rule excludes this copy from Git.

This is a copy of the **2026-11-07 11:41:02 UTC** snapshot, not a fresh snapshot
of current data. No Production pause or new backup run was performed. The five
copied files are database.sql.gz, files.tar.gz, backend-image.txt, mysql-image.txt
and SHA256SUMS. Image-ID files are not Docker image archives; environment secrets,
images, TLS keys and the repository are not part of this copy.

The directory is outside the automatic retention selection: backup.sh only
prunes matching timestamp directories directly under backups/. This copy is
manual, is not periodically refreshed and has no automatic retention. It shares
the same filesystem/disk as the original; it does not provide disk-loss recovery.
Use the same guarded restore script and the image IDs recorded in this snapshot,
not necessarily the currently deployed release.
