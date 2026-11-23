> Historical record: deployment paths and features may have changed. See [current layout](../README.md) and [current backup scope](BACKUP_AND_RESTORE.md).

# Local Production validation — 2026-11-07

## Scope

Read the DevOps plan (backup/restore, monitoring, smoke tests, deployment and
rollback), the official subject's DevOps modules and the handover recovery
requirements before testing. This verifies the current local infrastructure;
it does not certify all application features or complete the entire DevOps plan.

## Runtime results

| Check | Result |
| --- | --- |
| Production services | 11 long-running services running; available health checks healthy |
| Migration | Existing Production migration exited 0; restored stack ran migrations successfully with none pending |
| Startup ordering | Compose requires healthy MySQL before migration and successful migration before Backend; observed during isolated startup |
| HTTPS | Local certificate verified; `/health` returned 200 |
| Authentication rejection | Random nonexistent login returned 401; unauthenticated `/auth/profile` returned 401 |
| Grafana | Real authenticated HTTPS login succeeded; 56 provisioned panels; every dashboard expression accepted by Prometheus |
| Alerts | 16 rules healthy, fresh evaluation marker, zero active Production alerts during check |
| Logging | All current Production containers use json-file rotation, 10m / 3 files |
| Published ports | All published Production bindings limited to 127.0.0.1 |
| Backup scheduling | Daily 03:00 system-time cron entry present; cron service active; scheduled-backup log records successful 2026-11-07 execution |
| Restore | Latest backup checksums and archives valid; matching images; restored into a new isolated project |
| Database persistence | All restored table contents hashed before/after container recreation and matched; 27 tables including one temporary validation table |
| File persistence | A synthetic storage marker survived container recreation |
| Production impact | Every original Production container retained its ID/start time |

The backup tested was `backups/20261107T114102Z-peIeih`. Its files archive
contained **zero regular files**. Consequently, archive integrity was checked,
but recovery of real uploaded files was not exercised in this run. The storage
marker tested volume persistence, not the application's upload/download flow.
Database contents were compared internally without printing user data.

`transcendence-restore-final-20261107` used separate database/storage volumes and
networks, with no published ports. MySQL, migrate and Backend were recreated
inside that project. All temporary containers, volumes, networks and synthetic
data were removed after success. Existing backups were not modified/deleted.
No fresh backup was run because the current backup script stops Production
Backend briefly. Restore used the existing backup instead. No Production
container was stopped or recreated, and no backend source was changed.

API requests added ordinary log/metric events. Temporary test containers may
briefly remain in cAdvisor's cache, but Production queries filter their project.
Validation helpers/snapshots were created under `/tmp` and contain no printed
credentials. No visual browser verification was performed.

## Limits and remaining work

- Successful login/profile/workspace operations, real upload/download and
  multi-user Socket.IO flows need application fixtures and feature validation;
  401 checks do not prove these successful flows.
- Backend logging/application issues previously reported remain the backend
  team's responsibility; this pass did not fix or comprehensively retest them.
- Prepare identifiable release image tags and a rollback procedure. Isolated
  restore is not application rollback; schema compatibility must be considered.
- Complete the selected Minor's status page and disaster-recovery procedures,
  including a protected off-machine backup copy and a populated file restore.
- Finish frontend integration, CORS and feature-dependent OAuth/webhook tests.
- External alert delivery remains unconfigured; local rules/dashboard work.
- CI follows a validated manual deployment/release process.

Recommended next DevOps stage: versioned release images and rollback planning,
reviewed against the PDFs before changes. Do not interrupt Production for a
rollback drill without explaining and agreeing its impact first.
