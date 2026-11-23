> Historical record: deployment paths and features may have changed. See [current layout](../README.md) and [current backup scope](BACKUP_AND_RESTORE.md).

# Production security review and changes — 2026-11-08

Scope: DevOps plan phases 19–20, current local Production runtime, Nginx and
production npm dependencies. No backend application source or package versions
were changed. This is a targeted configuration review, not a penetration test
or certification that the application has no vulnerabilities.

## Verified baseline

- Only Nginx publishes Production ports, on 127.0.0.1:80/443. Host listener
  inspection found no listening 3000, 3306, 2375/2376 or SSH port at review time.
- Database and monitoring networks are internal. No privileged container was found.
- Backend runs UID1000. MySQL's server PID1 runs UID999 even though docker exec
  defaults to root; Nginx's master runs root with its normal capabilities.
- Real TLS tests rejected 1.0/1.1 and accepted 1.2/1.3 with local certificate
  verification. HTTP redirects to HTTPS with 308.
- Nginx rejected a declared 12 MiB request with 413 without uploading that body.
  Its 11 MiB cap allows multipart overhead for the backend's 10 MiB file limit.
- Anonymous Grafana API access returned 401. An untrusted Origin was not granted
  cross-origin access by /health. Frontend CORS requirements still need coordination.
- .env and TLS private key were 600; backup directories 700 and ignored by Git.
  Secret values were not printed. Length/uniqueness alone do not prove entropy.

## Applied changes

### MySQL credentials

The previous app/root passwords were identical and under 12 characters. Rotated
only the verified accounts: the configured application user at %, root at %,
and root at localhost. App and root now use distinct randomly generated
32-byte values encoded as 64 hexadecimal characters. Root's two host entries
share its new administrator password; it differs from the app password.

Account changes were made inside MySQL, not merely .env. Persisted the matching
values atomically in .env with mode600. Held the existing backup lock throughout
the rotation/recreation to prevent a concurrent backup. Backend was stopped
briefly; MySQL, migrate, Backend and Nginx were recreated with their existing
volumes/images. The historical migration container was replaced so it no longer
retains the old environment. No new migrations were pending.

Confirmed the new root login and a real database query using Backend's new
credential. The isolated mysqld-exporter account/password was not changed.
Update protected recovery copies of private configuration after credential
rotation. Existing development database volumes retain their own old accounts;
changing the shared .env does not rotate those stopped development instances.
No development volumes were changed or removed.

### Container settings

| Service | Memory cap | CPU quota | Additional protection |
| --- | --- | --- | --- |
| Backend | 512 MiB | 1 CPU | cap_drop ALL; no-new-privileges |
| migrate | 512 MiB | 1 CPU | cap_drop ALL; no-new-privileges |
| MySQL | 768 MiB | 1 CPU | no-new-privileges |
| Nginx | 128 MiB | 0.5 CPU | no-new-privileges |

These are local starting limits, not reserved capacity. Observed idle usage
before changes was approximately 54 MiB Backend, 82 MiB MySQL and 17 MiB Nginx.
Runtime inspect verified all configured limits/security options; startup and
DB access passed with no OOM. Load testing is still needed before treating these
limits as appropriate for a larger workload. MySQL/Nginx retain capabilities
needed by their current root entrypoints; read-only root filesystems were not
introduced for these services.

### Nginx

Added an IP-based login bucket at 5 requests/minute, burst5, nodelay, returning
429 when full. The key applies only to case-insensitive /auth/login with an
optional trailing slash. Other routes have an empty key and are not counted.
The limit uses the actual peer address, not arbitrary client-supplied forwarded
headers. Shared client/NAT addresses share the bucket. Review proxy trust and
limits if deployment topology changes. This is rate limiting, not per-account
lockout or a substitute for application authentication security.

Eight bounded invalid-login requests returned six 401s then two 429s; the latter
included uppercase/trailing-slash routing. /health and /status stayed 200.
Added proxy_hide_header X-Powered-By and verified the Express header disappeared
from HTTPS responses. Existing TLS, upload size limits, nosniff and referrer
policy remain. HSTS was not introduced for this local self-signed deployment.

Reference: [Nginx request limiting documentation](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html).

## Backend dependency handoff — not fixed in this change

Ran npm audit --omit=dev --package-lock-only against a temporary copy through
the official npm registry. Audit reports 6 affected packages: 3 high, 3 moderate,
0 critical. This is a package count, not six distinct proven exploit paths.
Matched the versions below to files in the running image. No exploit/DoS payload
was sent and no npm audit fix, dependency install or lockfile update was run.

| Package | Runtime version | Audit severity | Relationship |
| --- | --- | --- | --- |
| @nestjs/platform-express | 11.2.5 | High | affected through nested multer |
| @nestjs/swagger | 11.4.7 | Moderate | affected through nested js-yaml |
| body-parser | 2.3.0 | High | production dependency |
| @nestjs/platform-express/node_modules/multer | 2.2.0 | High | direct top-level multer is 2.5.0, but does not replace this copy |
| @nestjs/swagger/node_modules/js-yaml | 5.3.0 | Moderate | Swagger dependency |
| qs | 6.16.0 | Moderate | production dependency |

Examples from the registry audit:

- [body-parser compressed-body DoS](https://github.com/advisories/GHSA-27r3-jxmh-p828)
- [Multer asynchronous fileFilter teardown DoS](https://github.com/advisories/GHSA-q7qp-rjg7-q26m)
- [js-yaml empty merge-source CPU use](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm)
- [qs stringify TypeError](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw)

Audit marks fixes available. The backend team should choose compatible updates,
check transitive versions, test affected flows and provide an updated lockfile.
Reachability depends on actual code/configuration; this audit does not prove
that every advisory can be exploited through this application. DevOps should
then build a new release and repeat the runtime audit and deployment checks.
No message was sent to the team by this work.

## Residual monitoring privileges

cAdvisor and docker-state-exporter retain Docker socket access; cAdvisor also
mounts the containerd socket and host paths. A :ro bind mount does not make a
Unix socket API read-only. A harmless /_ping over the mounted socket returned
200, confirming it remains usable. No mutating daemon operation was attempted.

These services have no host ports, run on the internal monitoring network and
already drop capabilities/use no-new-privileges. However, a compromised process
with socket access remains highly trusted. Socket-access mediation or another
collection architecture requires a separate compatibility-tested change; it
was not silently removed at the cost of breaking monitoring. Host mounts in
Node Exporter/cAdvisor also remain a data-exposure consideration.

## Operational evidence and limits

Compose and Nginx validation passed. Application query, migration exit0, HTTPS,
login throttling and runtime security-option checks passed. Test traffic is
visible in logs and API 4xx metrics. Maintenance may briefly produce availability
alerts; confirm fresh recovery measurements rather than hide that history.
No volumes were deleted, no dependency/source edits, and no Docker socket
exploitation or load test took place. Temporary audit/rotation/test helpers
were created under /tmp; private credentials were not printed in their results.


## Follow-up: Docker API mediation

The earlier socket finding above describes the review baseline. A subsequent
change routes both collectors' Docker calls through a default-deny proxy on a
separate internal network. Docker-state exporter is now non-root/socket-free;
cAdvisor no longer mounts Docker socket, host `/` or `/var/lib/docker`. Mock
policy tests and an isolated real-collector trial passed before rollout.
Inspect replies strip environment, commands and health-log details.

This reduces privileges but does not eliminate runtime access risk: cAdvisor
still requires the containerd socket with this Docker image store, and the proxy
itself retains raw Docker access. Neither is a fully isolated untrusted workload.
See Operating guide section 17 for implementation, verification and limits.
