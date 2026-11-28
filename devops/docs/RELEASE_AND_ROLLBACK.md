> Current scope: backup/restore covers MySQL only. Uploaded files are not restored.
> Deployment files now live in `devops/`; run commands from the repository root.

# Backend releases and rollback

This procedure covers the local Backend image. It does not change backend
source or deploy frontend/monitoring updates. Run from the repository root.
Production release/rollback interrupts Backend while its container is replaced;
use an agreed maintenance window and do not overlap the backup job.

## Selecting an image

Both `backend` and `migrate` use `BACKEND_IMAGE` from the shell or `.env`.
The default remains `transcendence-backend:prod` for existing installations.
A shell override affects only that command; it does not persist in `.env`.
After a successful deployment or rollback, update only `BACKEND_IMAGE` in `.env`
to the verified image, preserving all secrets. Remove stale shell overrides.

Never rebuild or retag an existing release name. Docker tags are mutable; this
is an operating rule, not registry-enforced immutability. Record the full image
ID, tested Git commit (only for a clean source tree), migration changes, backup
path, deployment time, health result and previous release for each deployment.
Preserve old images; do not prune them while they are rollback candidates.

## Preserved baseline — 2026-11-07

- Tag: `transcendence-backend:release-20261107-014b112ae18a`
- Image ID: `sha256:014b112ae18a19d6b8409786c2e046255ee6b6a65388819cc462aec0c7e704a0`
- Origin: exact image ID of the running Production Backend, not a rebuild.
- Source commit: not attested; the workspace has uncommitted changes.
- Production selection remains `transcendence-backend:prod`; `.env` was not edited.
- The tag is local only. It is not an off-machine image backup or registry push.

## Prepare a future release

1. Choose a new unique tag, for example a release version or clean Git commit.
2. Confirm the tag does not already exist, then build it once using the existing
   Dockerfile. Use the same image for migration and application execution.
3. Record its image ID and validate the release against a separate test
   environment before touching Production. The current `devops/scripts/restore.sh`
   restores in place; it does not create an isolated validation stack.
4. Ask the backend owner whether the previous application remains compatible
   with the database after the candidate migrations. Test that compatibility.
   Without evidence, do not treat image-only rollback as safe.

Example build commands (replace the example tag; stop on errors):

```bash
export BACKEND_IMAGE=transcendence-backend:release-REPLACE-WITH-UNIQUE-VERSION
# If this succeeds, STOP: this release name already exists.
docker image inspect "$BACKEND_IMAGE" --format '{{.Id}}'
# Only after confirming the tag is unused:
docker compose --env-file .env -f devops/docker-compose.prod.yml build backend
docker image inspect "$BACKEND_IMAGE" --format '{{.Id}}'
```

## Deploy during an agreed window

These are operator steps, not an automatic deployment script. Stop if any step
fails. Do not copy a placeholder as an actual release value.

1. Record the currently running Backend image ID and retain its release tag.
2. Take a fresh database/files backup with the **current** image selected using
   `make backup`. Save the printed backup path and verify both archives with
   `bash devops/scripts/restore.sh --check backups/YOUR_TIMESTAMP`. Avoid overlapping
   the backup with deployment; Backend remains online during the snapshot, so
   file and database contents can change between archive steps.
3. Set `BACKEND_IMAGE` to the tested candidate. Validate Compose, confirm MySQL
   is healthy, and stop Backend before running migrations so application writes
   do not overlap a schema change. This starts the maintenance interruption.
4. Run migrations and require exit code 0 before replacing Backend:

```bash
docker compose --env-file .env -f devops/docker-compose.prod.yml config --quiet
docker compose --env-file .env -f devops/docker-compose.prod.yml stop backend
docker compose --env-file .env -f devops/docker-compose.prod.yml run --rm --no-deps -T migrate
# Continue only after successful migrations:
docker compose --env-file .env -f devops/docker-compose.prod.yml up -d --no-deps --no-build --pull never --wait --wait-timeout 120 backend
```

5. Nginx resolves `backend` when loading configuration. Refresh its upstream
   after container replacement, then verify the external HTTPS route:

```bash
docker compose --env-file .env -f devops/docker-compose.prod.yml exec -T nginx nginx -t
docker compose --env-file .env -f devops/docker-compose.prod.yml exec -T nginx nginx -s reload
curl --fail --cacert devops/nginx/certs/fullchain.pem https://localhost/health
```

6. Test actual login/database-dependent application operations and inspect
   logs/monitoring. A fixed `/health` response alone does not prove correctness.
   Persist the verified selection in `.env` and record the release outcome.

A failed migration may have partially changed MySQL DDL. Stop and assess the
schema; do not blindly start the old application or rerun migrations.

## Roll back a compatible application release

Only use this when the previous application is known to support the current
schema/data. Select its retained release tag with `BACKEND_IMAGE`, verify its
ID against the release record, then run:

```bash
docker image inspect "$BACKEND_IMAGE" --format '{{.Id}}'
docker compose --env-file .env -f devops/docker-compose.prod.yml up -d --no-deps --no-build --pull never --wait --wait-timeout 120 backend
docker compose --env-file .env -f devops/docker-compose.prod.yml exec -T nginx nginx -t
docker compose --env-file .env -f devops/docker-compose.prod.yml exec -T nginx nginx -s reload
curl --fail --cacert devops/nginx/certs/fullchain.pem https://localhost/health
```

This replaces only Backend. It does not execute migrations, revert schema,
restore a backup, or delete volumes. Verify application operations, persist the
previous release selection in `.env`, and record the rollback result. The
migration container may still show its earlier image; it is a completed job,
not the currently running application. Future migrations use the selected image.

If schema compatibility is unknown or broken, do not run an automatic
`migration:revert` or overwrite Production data. Coordinate a forward fix or an
explicitly approved paired database/files recovery. Restoring an older snapshot
can discard subsequent writes. Preserve the current data before recovery.

## Isolated validation

The rollback drill uses a restored database and a temporary image derived from
the baseline whose startup command exits 1. It tests failed readiness and
replacement with the exact baseline image, plus unchanged database contents and
storage marker. This is an application-start failure drill without schema
changes; it does not establish compatibility with future migrations, validate
real future releases, or test a Production Nginx interruption.


Verified on 2026-11-07: the actual isolated drill failed candidate readiness,
restored the exact baseline image, became healthy, and preserved the hash of
all restored database table contents and the storage marker. All original
Production container IDs/start times were unchanged; host HTTPS health stayed
200. Test containers/volumes/networks and the deliberately bad image were
removed. The baseline tag was retained. A mismatched restore image was also
rejected before creating containers. Legacy Docker builder emitted a deprecation
warning while building the small test fixture; the build succeeded.


## Deployed update — 2026-11-07 18:57 UTC

- Current selection: `transcendence-backend:release-20261107-664624a-devops1`.
- Running image ID: `sha256:f74544bb4545f1a7892844423dd11e930aae2735f93422d141e106e1d725823c`.
- Source: backend commit `664624a` plus existing local DevOps changes; not a clean-commit build.
- Previous retained release: `transcendence-backend:release-20261107-014b112ae18a`.
- Executed `make update`: build, healthy MySQL, Backend stop, one-off migrations
  (none pending), Backend replacement, Nginx reload and verified HTTPS 200.
- Confirmed actual Backend database query and no pending migrations after startup.
- Persisted current selection in `.env`, keeping permissions 600 and other values.
- No fresh backup taken for this update; latest existing snapshot remains
  `backups/20261107T114102Z-peIeih`. No schema migration was applied.
- The previous completed Compose migration container remains historical; the
  update ran migrations in a temporary container using the new image.
- Build reported six dependency vulnerabilities (3 moderate, 3 high), with no
  dependency changes attempted. This deployment verifies infrastructure health,
  not the new file-deletion/retry feature's full behavior.
