# Local production deployment

This guide runs the backend production image behind Nginx on localhost.
It covers the current backend stack; the frontend and public staging deployment
are still pending. Run all commands from the repository root.

## Requirements

- Docker Engine and Docker Compose v2, with access to the Docker daemon.
- OpenSSL and curl.
- Internet access for the initial image and dependency downloads.
- Local ports 80 and 443 available.

## 1. Configure the environment

If `.env` does not exist, copy `.env.example` to `.env`. Preserve any existing
`.env`; do not overwrite working credentials.

```bash
cp -n .env.example .env
```

Keep the example's database name and user, or choose your own. Fill the three
application secrets: `DB_PASSWORD`, `DB_ROOT_PASSWORD` and `JWT_SECRET`.
Production monitoring also requires `GRAFANA_ADMIN_PASSWORD` and
`GRAFANA_SECRET_KEY`. Generate a separate value for each secret:

```bash
openssl rand -hex 32
```

Paste the values into `.env`; do not share them or commit them.
Production Compose uses `NODE_ENV=production`, `APP_PORT=3000`,
`DB_HOST=mysql` and `DB_PORT=3306` inside its containers regardless of the
development defaults in `.env`.

| Variable | Purpose |
| --- | --- |
| `DB_NAME` | Database created on the first MySQL volume initialization |
| `DB_USER` | Application database user |
| `DB_PASSWORD` | Password for that user |
| `DB_ROOT_PASSWORD` | MySQL root password, passed only to MySQL |
| `JWT_SECRET` | Secret used to sign and verify authentication tokens |
| `GRAFANA_ADMIN_USER` | Initial Grafana administrator username; defaults to `admin` |
| `GRAFANA_ADMIN_PASSWORD` | Strong initial Grafana administrator password |
| `GRAFANA_SECRET_KEY` | Stable key used by Grafana to protect stored secrets; preserve it with the Grafana data |
| `GITHUB_OAUTH_CLIENT_ID` | Optional GitHub OAuth application identifier |
| `GITHUB_OAUTH_CLIENT_SECRET` | Optional GitHub OAuth application secret |
| `GITHUB_OAUTH_CALLBACK_URL` | Use `https://localhost/github/callback` for local integration; configure the same URL in the GitHub OAuth application |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | Required when saving repository tokens; generate with `openssl rand -base64 32` |

GitHub variables may remain empty while testing the core backend. OAuth flows
and repository token storage require their corresponding configuration.

MySQL initialization variables apply when the data volume is first created.
Changing a password in `.env` later does not change an existing MySQL account's
password. Coordinate credential changes instead of deleting the data volume.

## 2. Create the local TLS certificate

Skip generation if the existing localhost certificate and key are still valid.
The certificate must cover `localhost` and `127.0.0.1`.

```bash
mkdir -p nginx/certs
openssl req -x509 -newkey rsa:2048 -sha256 -nodes \
  -keyout nginx/certs/privkey.pem \
  -out nginx/certs/fullchain.pem \
  -days 365 \
  -subj '/CN=localhost' \
  -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
chmod 600 nginx/certs/privkey.pem
```

Both files are ignored by Git. The private key must remain private.
This self-signed certificate is for local testing; browsers will warn unless
it is explicitly trusted. Public staging requires its own hostname and a
certificate appropriate for that hostname.

## 3. Validate and start

For the initial setup, use the commands below. For subsequent versioned releases,
follow [Release and rollback](RELEASE_AND_ROLLBACK.md); do not run `--build`
against a retained release tag. `BACKEND_IMAGE` selects the same image for
Backend and migrations, defaulting to `transcendence-backend:prod`.

```bash
docker compose -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps -a
```

Expected state:

- `mysql`: running and healthy.
- `migrate`: exited with code 0, including when no migrations are pending.
- `backend`: running and healthy.
- `nginx`: running.
- `prometheus` and `grafana`: running and healthy.

Startup order is MySQL healthy, successful migrations, backend healthy, then
Nginx. The migration container runs `npm run migration:run:prod` using compiled
JavaScript from `dist`. It must succeed before the backend starts.

## 4. Check HTTPS and routing

```bash
docker compose -f docker-compose.prod.yml exec nginx nginx -t
curl --cacert nginx/certs/fullchain.pem https://localhost/health
curl -I http://localhost/health
```

The HTTPS request should return:

```json
{"status":"ok","service":"backend"}
```

The HTTP request should return status 308 with
`Location: https://localhost/health`. Swagger is at `https://localhost/api`.
Only Nginx publishes host ports, bound to loopback. Backend and MySQL are
reachable through Docker networking, not published directly on the host.

The current health endpoint checks backend liveness. It does not independently
check database readiness or storage availability.

## 5. Logs and routine operations

All production services use Docker's `json-file` logging driver with
`max-size: "10m"` and `max-file: "3"`. Docker rotates a container's log when it
reaches the configured size, retaining up to three files including the current
one (approximately 30 MB per container). These are size limits, not a time-based
retention policy or an archive. Docker captures stdout/stderr only; this does
not collect arbitrary files written inside containers.

To follow a specific service with timestamps:

```bash
docker compose -f docker-compose.prod.yml logs --follow --timestamps --tail=100 backend
```

Replace `backend` with `nginx`, `mysql` or `migrate` to inspect that service.
Use Ctrl+C to stop following logs; it does not stop the container.
Changing Docker logging options requires container recreation, not just a
restart. Logs attached to a removed container are not kept by this setup, so
export needed logs before recreating containers. Persistent application data
volumes are separate and are not removed by recreation.

This configures local log rotation only. It does not implement ELK, centralized
search, log archiving, or a standard application log format. Backend log content
remains the backend owner's responsibility. The scheduled backup has its own
file log and rotation, documented in the backup guide.

Nginx uses the `app_access` format in `nginx/nginx.conf` for both HTTP and
HTTPS access logs. It records the client address, timestamp, method, normalized
path (`$uri`), protocol, status, response bytes, and request/upstream times.
It omits query parameters, Referer, User-Agent, Authorization, cookies, and
request bodies. The complete query still reaches the backend and remains in
HTTP-to-HTTPS redirects; only access logging changes.

After editing Nginx configuration, validate it before reloading:

```bash
docker compose -f docker-compose.prod.yml exec -T nginx nginx -t
docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload
```

This is a graceful Nginx reload, not container recreation. On 7 November 2026,
synthetic query/header markers were absent from new access logs, while HTTPS
health, HTTP 308 redirects, and an Engine.IO polling handshake succeeded.
The handshake confirmed that required query parameters still reached the backend.
The temporary Engine.IO session was closed after the test.

This is access-log minimization, not universal secret redaction: previous logs
are not rewritten, and Nginx error logs and backend logs use separate mechanisms.
Error logs can include request details on failures; this test did not simulate
those failures. Sensitive values must also stay out of URL path segments.
See the [Nginx logging documentation](https://nginx.org/en/docs/http/ngx_http_log_module.html).

The application logging review also found missing logs for rejected login and
Socket.IO authentication, and a reproduced silent file-deletion failure in an
isolated `FilesService` test. These remain backend-team follow-ups; no backend
code was changed. Details and test boundaries are in the progress report.

```bash
docker compose -f docker-compose.prod.yml logs --tail=100 nginx backend migrate mysql
docker compose -f docker-compose.prod.yml stop
docker compose -f docker-compose.prod.yml up -d
```

To rebuild after a backend code change:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml restart nginx
```

Restart Nginx after recreating the backend because this configuration resolves
the upstream backend address when Nginx loads its configuration.
Review migration logs and repeat the HTTPS checks after deployment.

To remove the stack's containers and networks while retaining data:

```bash
docker compose -f docker-compose.prod.yml down
```

Do not add `--volumes` or `-v` when retaining data. Avoid the current Makefile's
`fclean` target for routine operations: it removes Docker resources across the
host, including volumes.

## 6. Monitoring foundation: Prometheus and Grafana

Open `https://localhost/grafana/` and log in with `GRAFANA_ADMIN_USER`
(default `admin`) and `GRAFANA_ADMIN_PASSWORD` from the local `.env` file.
Anonymous access and self-registration are disabled. Cookies require HTTPS.
The browser must trust the existing local TLS certificate, as for the backend.
No new host ports are published: Nginx is the entry point, and Prometheus is
reachable only through the internal monitoring network.

Pinned images are `prom/prometheus:v3.16.0` and `grafana/grafana:12.4.14`.
Both services use log rotation and persistent named volumes. Their memory
limits are 256 MiB and 512 MiB respectively, with a one-CPU limit each. These
are initial local limits to revisit as targets and dashboards grow.

`monitoring/prometheus.yml` scrapes Prometheus, Node Exporter, and cAdvisor every
15 seconds. Node Exporter supplies Linux host CPU, RAM, and filesystem metrics.
Backend, MySQL, API errors, container restarts, and alert rules remain pending;
the Monitoring Major is not complete.

`monitoring/grafana-datasource.yml` provisions a default data source named
`Prometheus`, UID `prometheus`, at `http://prometheus:9090`. Grafana queries it
server-side; the browser does not need a published Prometheus port. The data
source is managed by the file, so it is not editable in the UI.

After login, Home displays **Transcendence - Monitoring Overview** automatically.
Direct link: [Monitoring Overview](https://localhost/grafana/d/transcendence-monitoring/transcendence-monitoring-overview).
It refreshes every 15 seconds and initially shows the last 15 minutes. No query
entry is required. Existing Explore tabs stay in Explore: click Home or the link.

`monitoring/grafana-dashboards.yml` provisions the dashboard JSON from
`monitoring/dashboards/monitoring-overview.json`. Compose mounts both read-only
and sets `GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH`. Edit these source files
for lasting changes; UI saves are disabled. File provisioning checks every 30 seconds.

The upper panels show Linux host metrics: Node Exporter scrape status, CPU,
RAM, root filesystem usage, and available filesystem space. The lower panels
retain Prometheus process metrics, uptime, self-scrape duration, and active series.
Host metrics include all workloads on the machine, including processes outside
Docker. A missing sample is not a healthy status. Scrape duration is not API latency.

Node Exporter uses `prom/node-exporter:v1.12.1`, with only CPU, meminfo, and
filesystem collectors enabled. It reads host `/proc`, `/sys`, and the root
filesystem through read-only bind mounts. The root mount uses `rslave` to see
host submount changes. It runs as UID/GID 65534, with a read-only container root,
no Linux capabilities, no-new-privileges, a 128 MiB memory limit and 0.5 CPU limit.
It has no published host port and uses only the internal monitoring network.
These mounts expose host information to the exporter; this setup is for a Linux
Docker host. Windows/macOS Docker Desktop would measure its Linux VM instead.
No separate Dockerfile or storage volume is required.

Metric definitions:

- Host CPU: non-idle time averaged across all logical CPUs over five minutes,
  including I/O wait. 100% means all CPUs non-idle. At least two scrapes are needed.
- Host RAM used: `100 * (1 - MemAvailable / MemTotal)`; reclaimable RAM counts
  as available. This panel does not include swap usage.
- Root filesystem used/reserved: `100 * (1 - available / size)`. Reserved
  space counts as unavailable, so this can differ from `df`'s Use% formula.
- Filesystem available space: available bytes by mount, excluding pseudo and
  snap mounts. This is free capacity, not disk I/O performance.
- Node Exporter UP means its metrics endpoint is reachable, not application health.

To start the exporter, validate configuration and reload Prometheus:

```bash
docker compose -f docker-compose.prod.yml up -d --no-deps node-exporter
docker compose -f docker-compose.prod.yml exec -T prometheus promtool check config /etc/prometheus/prometheus.yml
docker compose -f docker-compose.prod.yml kill -s SIGHUP prometheus
```

The last command sends a reload signal; it does not stop Prometheus.
Grafana picks up the JSON changes through file provisioning. Refresh an already
open dashboard once to load its new layout; metric refresh then runs every 15 seconds.
See [Node Exporter documentation](https://github.com/prometheus/node_exporter)
and the [pinned release](https://github.com/prometheus/node_exporter/releases/tag/v1.12.1).

Optional: in Grafana Explore, select Prometheus and run:

```promql
up{job="prometheus"}
```

A value of `1` means the self-scrape succeeded. It does not mean the backend
or database is healthy.

Prometheus keeps samples for up to 7 days, with a 512 MB block-retention limit;
whichever limit applies first removes old blocks. WAL and head data require
additional space, so this is not a hard 512 MB volume quota. Grafana stores
users, data sources, and future dashboards in its own volume. Neither volume
is included in the existing application database/file backup script.

To validate and start only these services:

```bash
docker compose -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.prod.yml run --rm --no-deps --entrypoint promtool prometheus check config /etc/prometheus/prometheus.yml
docker compose -f docker-compose.prod.yml up -d --no-build --wait prometheus grafana
docker compose -f docker-compose.prod.yml exec -T nginx nginx -t
docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload
```

Nginx forwards `/grafana/` with its prefix intact because Grafana serves that
subpath. Dynamic Docker DNS resolution prevents Grafana being offline from
blocking Nginx startup; requests to Grafana will fail while it is unavailable,
but backend routing remains independent. The existing backend routes, TLS,
WebSocket headers, and query-free access logging are retained.

Grafana initializes the admin account on a new Grafana volume. Changing its
initial password variable later is not a password reset for an existing account;
use Grafana's password-management flow. Keep `.env` private and preserve the
secret key. Do not delete volumes to reset credentials.

Next steps, approved separately: add restart counts and MySQL/HTTPS monitoring,
dashboards for those targets, and alert rules; determine notification delivery. Application
instrumentation remains the backend team's responsibility.

References: [Prometheus getting started](https://prometheus.io/docs/prometheus/latest/getting_started/),
[Grafana provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/),
and [Grafana reverse proxy setup](https://grafana.com/tutorials/run-grafana-behind-a-proxy/).

## Persistent data

The Compose project is named `transcendence-prod`, separate from the development
stack. Its named volumes are:

| Volume | Container path | Contents |
| --- | --- | --- |
| `transcendence-prod_mysql_data` | `/var/lib/mysql` | MySQL data |
| `transcendence-prod_backend_storage` | `/app/storage` | Uploaded workspace files |
| `transcendence-prod_prometheus_data` | `/prometheus` | Monitoring time series |
| `transcendence-prod_grafana_data` | `/var/lib/grafana` | Grafana configuration and users |

Fresh production volumes start empty; they do not copy development data.
Persistence survives container replacement but is not a backup. See
[Backup and restore](BACKUP_AND_RESTORE.md) for manual database/file snapshots
and isolated restoration. Daily scheduling and seven-backup retention are
configured; off-machine copies remain separate work.

## Verification completed

The following manual checks passed during local setup:

- Production image build and discovery of 24 entities and 3 compiled migrations
  without loading `ts-node`.
- MySQL health and migration completion before backend startup.
- A temporary database row and file survived recreation of the MySQL,
  migration and backend containers using the same volumes. Test data was removed.
- Nginx configuration validation, local HTTPS routing and HTTP redirect.
- Registration and login over HTTPS with explicit trust of the local certificate;
  authenticated Socket.IO readiness and upgrade from polling to WSS through
  Nginx. The temporary account was logged out and removed.

These checks do not cover frontend browser flows, message exchange between
multiple users, public staging, backup restoration or a complete rollback.
Dependency audit findings reported during the build still require a separate
review.


Monitoring foundation validation on 7 November 2026 passed: authenticated
Grafana access over verified HTTPS, anonymous API denial, data-source health,
a real self-scrape query, and historical metric/admin-login persistence after
recreating only the monitoring containers. The original application containers
were unchanged. Grafana 12.4.14 was selected after 13.3.0 failed on initial
data-source provisioning; only this task's new Grafana initialization volume
was reset during that correction.


## 8. Container resource usage with cAdvisor

The same default dashboard includes cAdvisor status, an observed-container
count, and per-container CPU, RAM working set, network received/sent bytes per
second, and disk read/write bytes per second. Refresh the browser once to load
the new panels; metrics refresh every 15 seconds. Legends use Docker container
names, filtered to the `transcendence-prod` Compose project. The completed one-shot `migrate`
container is stopped and has no current resource usage. Missing data does not
mean zero usage or a healthy container. Historical graphs can retain old names.

CPU is a percentage of one core: 100% means one core and values may exceed
100%. It is averaged over five minutes, not normalized to the container quota.
RAM working set subtracts inactive file cache from usage; it is not process RSS.
Network and disk rates sum interfaces/devices per container. Disk I/O measures
activity, not the size of a volume or free disk capacity. Scrape status proves
exporter reachability, not application health. Restart counting is provided by the separate Docker-state exporter.

`ghcr.io/google/cadvisor:v0.60.6` runs on the internal monitoring and docker_api networks,
with no host port, a read-only root, dropped capabilities, no-new-privileges,
a 256 MiB RAM limit and a half-CPU limit. Privileged mode was not needed.
CPU, memory, network, and diskIO collectors are enabled. Exported Docker labels
are limited to Compose project/service; environment variables are not enabled.

Current cAdvisor mounts are host `/proc` at `/rootfs/proc`, `/sys`, and the
containerd socket, all read-only. Full host-root, Docker-storage and Docker-socket
mounts have been removed after a successful compatibility test. Docker API calls
now go through the restricted proxy described in section 17. This host's
containerd image store still requires the containerd socket to register the
Docker factory and load container metadata. That socket remains powerful and
is not made API-read-only by its mount flag. Keep this residual access explicit;
the proxy does not mediate containerd. Host paths need review on other installs.
OOM-event detection is unavailable without `/dev/kmsg`; it is outside this step.

Prometheus scrapes `cadvisor:8080`. Start cAdvisor, validate the configuration,
and reload Prometheus without restarting application services:

```bash
docker compose -f docker-compose.prod.yml up -d --no-deps cadvisor
docker compose -f docker-compose.prod.yml exec -T prometheus promtool check config /etc/prometheus/prometheus.yml
docker compose -f docker-compose.prod.yml kill -s SIGHUP prometheus
```

On 7 November 2026, all six resource metric families covered all nine running
Docker containers. All 21 dashboard expressions returned data via Grafana,
including its panel query API. RAM working sets agreed with `docker stats`
within the larger of 32 MiB or 25%, allowing collection timing and accounting
differences. This is a sanity check, not exact synchronized measurement.
Original application container IDs/start times were unchanged and HTTPS health
returned 200. No backend changes were required.

References: [cAdvisor Docker setup](https://github.com/google/cadvisor/blob/master/docs/running.md)
and [pinned release](https://github.com/google/cadvisor/releases/tag/v0.60.6).


Development containers `backend` and `mysql` were stopped on 7 November 2026
when switching to Production-only operation. Their volumes and Compose files
were retained. Use `docker compose -f docker-compose.yml up -d` when development
is needed again; the Production dashboard remains filtered to Production.
Host CPU/RAM always include every workload running on the machine.


## 9. Production HTTPS availability with Blackbox Exporter

The Home dashboard now has HTTPS status, exporter status, HTTP response code,
certificate days remaining, probe duration, and availability history. It refreshes
at 15-second intervals. `probe_success` is the actual health result; exporter
`up` alone only means Prometheus could collect the exporter response.

`monitoring/blackbox.yml` defines a five-second GET probe requiring verified
TLS, HTTP 200 and the expected `status: ok` and `service: backend` body fields.
Redirects are rejected. Prometheus probes `https://nginx/health` through Docker
DNS, passing HTTP Host and TLS server name `localhost` to match the local cert.
The existing public certificate is mounted as the trusted CA; the private key
is not mounted and `insecure_skip_verify` remains false.

Flow: Prometheus -> Blackbox Exporter -> HTTPS Nginx -> Backend /health.
The fixed backend health response does not test MySQL. This probe originates
inside Docker, so it does not verify host published ports, outside connectivity,
or browser certificate trust. Duration includes the whole probe, not general
API latency. Health probes add normal GET /health traffic to Nginx access logs.

The pinned `prom/blackbox-exporter:v0.29.1` service joins monitoring and application
networks with no published port, UID/GID 65534, read-only filesystem, dropped
capabilities, no-new-privileges, 128 MiB RAM and half-CPU limits. Prometheus has
separate jobs for exporter self-metrics and the `/probe` request. Relabeling
passes the target URL while directing the scrape to `blackbox-exporter:9115`.

To start it and reload the validated Prometheus configuration:

```bash
docker compose -f docker-compose.prod.yml up -d --no-deps blackbox-exporter
docker compose -f docker-compose.prod.yml exec -T prometheus promtool check config /etc/prometheus/prometheus.yml
docker compose -f docker-compose.prod.yml kill -s SIGHUP prometheus
```

Certificate renewal must preserve the localhost identity or update the probe's
server name and CA file accordingly. Recreate Blackbox Exporter if replacing
the mounted certificate file by rename, then verify probe success again.

Runtime checks passed for the real HTTPS endpoint and failure cases: nonexistent
path, plain HTTP, and a closed port all produced `probe_success = 0`. These were
one-off probes, without stopping production. The scheduled real target returned
1, HTTP 200 and TLS enabled. All 27 distinct dashboard expressions returned data
through Grafana, with 32 panels on Home. The eight running Production containers
were covered by cAdvisor, and original application containers were unchanged.

Remaining work: MySQL availability, restart counts, API error rates and alerts.
Reference: [Blackbox configuration](https://github.com/prometheus/blackbox_exporter/blob/master/CONFIGURATION.md).


## 10. MySQL connectivity and basic server metrics

`prom/mysqld-exporter:v0.21.0` connects to `mysql:3306` using the dedicated
`monitoring_exporter` account. It exposes metrics only on the internal monitoring
network and also joins the database network. No host port or application-network
connection is added. The container is non-root, read-only, drops capabilities,
disallows privilege escalation and has 128 MiB/half-CPU limits.

Only global_status and global_variables collectors are enabled. The other
default collectors (replication and information-schema collectors) are disabled.
For this limited scope on MySQL 8.4, the account needs only USAGE (login), with
MAX_USER_CONNECTIONS 3. It has no application-table SELECT or write grants.
Do not enable extra collectors without reviewing their privilege requirements.
Exporter queries have a three-second timeout and a maximum pool size of two
connections per scrape. The account permits Docker-network connections (`%`);
network isolation and its separate password protect access.

`MYSQL_EXPORTER_PASSWORD` is a separate 64-character random hexadecimal secret
in ignored `.env`, never in source control. It is supplied only to the exporter
as `MYSQLD_EXPORTER_PASSWORD`, not to Backend. Administrators with Docker access
can inspect container environment variables; they are not a secret vault.

For a new deployment or fresh restored MySQL volume:

1. Generate and save `MYSQL_EXPORTER_PASSWORD` in `.env` (64 hexadecimal characters).
2. Start MySQL: `docker compose -f docker-compose.prod.yml up -d --wait mysql`.
3. Run `python3 scripts/setup-mysql-monitoring.py` from the project.
4. Start the exporter: `docker compose -f docker-compose.prod.yml up -d --no-deps mysqld-exporter`.
5. Validate/reload Prometheus as above and check MySQL connection is UP in Grafana.

The setup script uses the existing root password inside the MySQL container to
create/update only the named monitoring account. It suppresses SQL/error output
that could expose secrets and refuses to overwrite an account with unexpected
grants. Python 3 and Docker Compose are required. Password rotation requires
updating `.env`, rerunning setup, and recreating the exporter. Existing user/data
volumes are never deleted by this process.

Eight new panels show exporter scrape status, MySQL connection status, connected
clients, maximum connections, client statements/second, connections history,
uptime and running threads. Server metrics include health checks and monitoring
traffic, not just application work. `up{job="mysql"}` reports exporter reachability;
`mysql_up{job="mysql"}` reports the MySQL login/ping result. Neither proves that
Backend's own database credentials or queries work. Alerts remain separate work.

Runtime verification passed for all 34 distinct dashboard expressions and 40
panels. MySQL connection returned 1; a one-off probe to closed port 3307 returned
0 without stopping MySQL. `SHOW GRANTS` confirmed USAGE only and the connection
limit of 3; a real SELECT attempt with LIMIT 0 against an application table was
denied (1142), without reading rows. Exported max_connections matched MySQL's
own value. Original application containers remained unchanged and HTTPS health
returned 200. Production now has nine running containers, covered by cAdvisor.

Reference: [MySQL exporter](https://github.com/prometheus/mysqld_exporter).


## 11. Docker RestartCount and running state

`monitoring/docker-state-exporter.mjs` is a small standalone Node exporter using
only built-in modules. It issues fixed GET requests to Docker API v1.45 through
`http://docker-api-proxy:2375`: list all containers filtered by Compose project, then inspect
their state. It exposes only name, service, project, container ID, RestartCount,
and Running state. Environment variables and inspect payloads are never exported.
HTTP clients cannot choose Docker API paths, projects, or arbitrary targets.

Compose connects it to internal monitoring and docker_api networks without a
published port, using pinned Node 22. It now runs UID/GID 65534, with no daemon
socket mount. Its script/root filesystem are read-only, capabilities dropped,
no-new-privileges enabled, and limits remain 64 MiB/quarter CPU. HTTP callers
cannot select proxy targets or API routes. See section 17 for the proxy boundary.

Prometheus scrapes `docker-state-exporter:9105` every 15 seconds. Dashboard
panels show collection status, per-container RestartCount, its history, and
Running state of long-running services. The successful stopped one-shot
`migrate` is excluded from the running-state panel, not from inspection.
A removed container has no current series; running=1 is not application health.

RestartCount is Docker's value for the current container ID, particularly useful
for automatic restart loops. It is not a lifetime count of all deployments or
manual restarts. Recreation or restart-manager reset can reset it, so the metric
is a gauge and includes container_id. No inferred "restarts in 15 minutes" is
claimed. Historical lines distinguish old and new IDs.

`docker_state_up=0` means collection failed; that scrape omits container metrics
instead of reusing stale healthy data. `up{job="docker-state"}` separately reports
whether Prometheus could reach the exporter. `/healthz` checks only the process.

Start/reload:

```bash
docker compose -f docker-compose.prod.yml up -d --no-deps docker-state-exporter
docker compose -f docker-compose.prod.yml exec -T prometheus promtool check config /etc/prometheus/prometheus.yml
docker compose -f docker-compose.prod.yml kill -s SIGHUP prometheus
```

Runtime checks matched RestartCount and Running exactly against all 11
Production container inspections (10 running plus completed migrate). All 37
distinct dashboard expressions returned data; Home has 44 panels. An isolated
fixture using restart policy on-failure:2 actually crashed/restarted twice, and
a separately scoped exporter reported 2 and stopped state. A missing-socket
exporter reported collection DOWN without container data. POST was rejected
and arbitrary Docker paths returned 404. All three temporary containers were
removed. No production application service was restarted for the test.

Remaining Monitoring work: API errors and alert rules/delivery. Before deployment
on a different Docker engine, verify API v1.45 compatibility and socket location.
Reference: [Docker Engine API](https://docs.docker.com/reference/api/engine/version/v1.45/).


## 12. Observed API requests and errors through Nginx

Nginx now sends a second minimal access-log stream to
`nginxlog-exporter:5531` over internal UDP syslog. Existing stdout access logs,
query omission and Docker log rotation are preserved. No extra disk log or
persistent volume is created. The metrics event includes only a bounded method,
a constant synthetic request path/protocol, final status, response bytes and
request duration. No real URL, query string, client IP, header, cookie or body
is forwarded to the metrics receiver. Unknown methods map to OTHER.

Only HTTPS backend-route traffic is counted, excluding exact `/health`,
`/grafana` and its subpaths, and `/socket.io` and its subpaths. HTTP redirects
and direct requests bypassing Nginx are excluded. At present Nginx proxies
remaining routes to Backend; revise this scope when Frontend routing is added.
4xx includes expected client/authentication failures, not only application bugs.
5xx covers final server/gateway errors seen by clients. WebSocket frame errors
and errors hidden in HTTP 200 responses are outside these counters.

The receiver is `quay.io/martinhelmich/prometheus-nginxlog-exporter:v1.11.0`,
configured by `monitoring/nginxlog.yml`. It has no host ports or Docker socket,
uses only application/monitoring networks, and runs non-root with read-only
root/config, dropped capabilities, no-new-privileges and 128 MiB/half-CPU limits.
Labels are bounded method/status plus static environment; real paths are never
metric labels. `print_log` is disabled. Prometheus scrapes port 4040 every 15s.

Eight additional panels show exporter status, responses observed since receiver
startup, request rate, 5xx percentage, status-code rates, 4xx/5xx percentages,
mean request duration and parser errors. Rate/percentage windows are five
minutes. No observed traffic gives undefined percentages/mean duration and
`No traffic / no data`, not a fabricated 100% success rate. Request-rate panels
are gated by exporter scrape health. Zero parser errors proves parsing only,
not delivery of every message.

Delivery is best-effort UDP with no replay: events can be lost during downtime
or overload. Exporter counters reset on restart; Prometheus rate handles observed
resets but cannot recover lost events. This is operational visibility, not an
exact audit/billing record. Exporter UP alone does not prove that Nginx messages
are arriving. Nginx resolves the receiver's name when loading configuration:
**reload Nginx after recreating this exporter if its IP changes**. Compose adds
startup ordering so the receiver's Docker DNS record exists before Nginx starts.

```bash
docker compose -f docker-compose.prod.yml up -d --no-deps nginxlog-exporter
docker compose -f docker-compose.prod.yml exec -T nginx nginx -t
docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload
docker compose -f docker-compose.prod.yml exec -T prometheus promtool check config /etc/prometheus/prometheus.yml
docker compose -f docker-compose.prod.yml kill -s SIGHUP prometheus
```

Real safe production GETs returned/count 200, 401 and 404. Separate isolated
Nginx/receiver containers returned/count 200, 404 and 503 exactly, and verified
excluded routes and absence of a synthetic URL marker from metrics. Those
containers/config were removed. Production exclusion checks also passed and
parser errors stayed zero. All 44 distinct dashboard expressions returned data
through Grafana after generating traffic; Home has 52 panels. The idle mean
panel correctly has no sample when no requests occur. Temporary removed
containers briefly remained in cAdvisor's all-container cache; Production-filtered
coverage matched the 11 running services. Original application IDs/start times
were unchanged; only a graceful Nginx reload was needed. No backend code changed.

References: [Nginx syslog](https://nginx.org/en/docs/syslog.html) and
[log exporter](https://github.com/martin-helmich/prometheus-nginxlog-exporter).
Local alert rules are documented in section 13 below; external delivery is not configured.

## 13. Local alert rules

Prometheus evaluates `monitoring/alerts.yml` every 15 seconds. Grafana's Home
Dashboard shows firing/pending counts, the age of the last rules marker and an
active-alert table. These are Prometheus rules displayed through dashboard
queries, not Grafana-managed alert definitions. No Email/Discord destination
or Alertmanager is configured; alerts are visible locally only.

`pending` means the condition is true but its waiting period has not elapsed.
`firing` means it remained true for that period. A resolved alert disappears
from the active table; this table is not a permanent incident history. An empty
table is reassuring only when the marker is fresh and the datasource works.

| Condition | Waiting period |
| --- | --- |
| Scrape target down/missing, HTTPS backend unavailable, MySQL unavailable, Docker state unavailable, expected Production container absent/stopped | 1 minute |
| Required host metrics missing | 2 minutes |
| Host CPU above 90% (5-minute average) | 10 minutes |
| Available host RAM or root disk below 10% | 5 minutes |
| At least 3 observed restarts of the same container ID in 15 minutes | 1 minute |
| MySQL connections above 80% of its limit | 5 minutes |
| API 5xx above 5%, with at least 20 observed requests in 5 minutes | 2 minutes |
| New API log parse errors | 1 minute |
| TLS certificate expires in less than 14 days | 10 minutes |
| New Prometheus rule evaluation failures | 1 minute |

These are initial thresholds to adjust to the workload. Host usage includes
other applications on this machine. The expected-container recording rule lists
13 long-running Production services; update it when adding/removing services.
The completed `migrate` container is deliberately excluded. Restart detection
cannot recover increments before the first scrape or across container recreation.

A backup that stops the backend for over a minute can trigger a legitimate
availability alert. UDP log delivery gaps are not proven absent by exporter UP.
This stack cannot deliver a warning when the entire host or Prometheus is down;
independent external monitoring is needed for that. External notification routing
remains a separate choice, with no destination or credentials assumed.

Validate configuration and the 26 rule scenarios:

```bash
docker compose -f docker-compose.prod.yml exec -T prometheus promtool check config /etc/prometheus/prometheus.yml
docker run --rm --network none -v "$PWD/monitoring:/rules:ro" --entrypoint promtool prom/prometheus:v3.16.0 test rules /rules/alerts.test.yml
```

After editing existing rules, validate them then send Prometheus SIGHUP. Adding
this new bind mount initially required recreating only Prometheus; its named
data volume was retained. Grafana loads the dashboard change automatically.

A live isolated Prometheus/metrics fixture also exercised the actual Backend
rule: pending → firing after the one-minute hold → resolved after recovery.
Temporary containers/config were removed. Production Backend, MySQL, migrate
and Nginx retained their original IDs/start times; HTTPS health stayed 200.


## 14. Makefile commands

`make` lists the available commands. All targets use `docker-compose.prod.yml`.
`make up` starts the stack from existing images. `make build` builds Backend;
choose an unused `BACKEND_IMAGE` release tag before building a release.
`BACKEND_IMAGE=transcendence-backend:NEW-UNIQUE-TAG make update` builds first,
waits for MySQL, stops Backend, runs migrations, replaces Backend, waits for
health, reloads Nginx and checks HTTPS. Run only against an already provisioned
stack during an agreed maintenance window. If migrations fail, the recipe stops
with Backend stopped; assess schema state before recovery.

`make restart` restarts Backend and verifies readiness/HTTPS; use `make update`
to incorporate source changes. `make status`, `make logs`, `make health` and
`make backup` provide the common operations. Backup briefly stops Backend.
`make down`, `make clean` and `make fclean` remove only this Compose stack's
containers/networks and retain volumes/images. They never prune other projects.
After a successful update, persist the selected `BACKEND_IMAGE` in `.env`.
The Makefile does not automatically rewrite secrets or perform schema rollback.


## 15. Local Status page

Open https://localhost/status (or `/status/`). The page refreshes every 15 seconds
and offers manual refresh. Backend uses Blackbox HTTPS `probe_success`; Database
uses `mysql_up`. Both require successful, recent exporter scrapes. This is
availability of the monitored services, not proof that all application features
work or that Backend can query MySQL using its own connection.

The small `status-page` Node service makes only four fixed Prometheus queries
and returns a sanitized `/status/api` response: component names, states and
measurement times. It never exposes arbitrary PromQL, internal addresses,
credentials or raw metrics to the browser. No Backend source was changed.
It runs UID/GID 65534, read-only, with no Docker socket/database credentials or
host port, on the application and monitoring networks, limited to 64 MiB/0.25 CPU.

- Operational: a fresh successful service measurement and exporter scrape.
- Unavailable: a fresh failed service measurement with a successful scrape.
- Unknown: missing/ambiguous/invalid measurements, failed scrape, Prometheus
  failure, request timeout, or samples older than 60 seconds. Future timestamps
  beyond a five-second tolerance are also rejected.

Freshness uses `timestamp(metric)`, not the instant-query evaluation timestamp.
Overall is Unavailable if any service is down, otherwise Unknown if any state
is unknown; only two confirmed successes yield overall Operational. Browser
poll failures clear healthy results; existing results also expire locally.
The status API returns HTTP 200 even when its payload says down/unknown: it is
not a readiness endpoint. Container `/healthz` checks only that the page server
is responsive. No incident-history storage is implemented.

Nginx resolves the service dynamically; its absence does not block proxy startup.
The local page is unauthenticated and contains no sensitive details. `/status`
is excluded from API response/error counters, while normal stdout logs remain.
Expected-container alerts now include status-page, and resource panels discover
it through their existing Production filter.

If Nginx or the host is down the page cannot load. If only Prometheus is down,
the page can load and reports Unknown. WebSocket and GitHub checks are explicitly
not included until suitable real checks are implemented. Disaster recovery and
off-machine backup remain separate work; this page alone does not complete the
selected Minor.

Validation on 2026-11-08: actual HTTPS `/status`, `/status/`, `/status/api` and
`/health` returned 200; both components Operational with recent scrape times.
Local HTTP integration tests cover healthy/down, missing/stale/future/ambiguous
metrics, exporter failure, HTTP errors, malformed/oversized replies, timeouts
and disconnected Prometheus, plus rejected methods/routes and response privacy.
All 26 updated promtool scenarios passed. Repeated status visits did not alter
API response counters. Browser visual QA was not completed: the tool blocked
local-file preview. API checks are not a substitute for visual inspection.

```bash
node --test monitoring/status/server.test.mjs
docker compose -f docker-compose.prod.yml up -d --no-deps --no-build --wait status-page
docker compose -f docker-compose.prod.yml exec -T nginx nginx -t
docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload
```

Server changes require restarting status-page (HTML is read at server startup).
Do not edit Backend to change the status presentation. The initial activation
started only status-page, reloaded Nginx and reloaded Prometheus rules with
SIGHUP; application containers were not restarted.


## 16. Security settings

See [2026-11-08 security review](SECURITY_REVIEW_2026-11-08.md) for runtime evidence,
credential rotation, resource limits and the backend dependency handoff.
Backend/migrate drop all capabilities; Backend/migrate/MySQL/Nginx enable
no-new-privileges. Memory/CPU limits are 512 MiB/1 CPU for Backend/migrate,
768 MiB/1 CPU for MySQL and 128 MiB/0.5 CPU for Nginx; review under real workload.

Nginx limits /auth/login to 5 requests/minute per peer IP with burst5; excess
requests return 429. A shared client address shares this allowance. Other routes
are excluded from this bucket. Nginx hides upstream X-Powered-By headers.
App and root database credentials must be independently generated. Coordinate
MySQL account changes, .env and container recreation; .env edits alone do not
change existing accounts. Protect the updated environment recovery copy.

Dependency fixes remain pending. Docker API mediation is implemented in section
17; raw containerd access and the proxy daemon privilege remain residual risks.


## 17. Restricted Docker API proxy

`monitoring/docker-api-proxy.mjs` is a small dependency-free Node service. Only
it mounts the Docker socket for these two collectors. It listens on 2375 solely
inside a new internal `docker_api` network shared with cAdvisor and the state
exporter. No host port is published, and Backend/Grafana/Status page/Prometheus
are not attached to this network. Container dependencies require proxy health.

The proxy allows GET for versioned/unversioned ping, version, info, container
listing and full-64-hex-ID inspect, plus HEAD ping for Docker client negotiation.
All other methods/routes are denied before opening the daemon connection.
List queries allow only validated all/label-filter parameters. File archives,
logs, events, exec, image APIs, creation and deletion are not available. Client
headers/bodies are not forwarded; upgrade/CONNECT are rejected. Responses are
bounded to 8 MiB with a five-second total upstream deadline. Inspect/list replies
are reduced to collector metadata: no Env, Cmd, mount details or health log
payloads. This is not a general Docker API endpoint.

The proxy runs root to access the socket, with capabilities dropped,
no-new-privileges, read-only filesystem and 128 MiB/half-CPU limits. It remains
a trusted daemon-access component: compromising the proxy itself can bypass its
application-level allowlist. cAdvisor still has the separate containerd socket;
its privilege is not removed by restricting Docker HTTP. Host /proc and /sys
remain mounted for metrics. No claim of complete host isolation is made.

Docker-state exporter now runs non-root without any host runtime socket. cAdvisor
uses `--docker=tcp://docker-api-proxy:2375` and no longer mounts `/`,
`/var/lib/docker` or `/var/run/docker.sock`. For this image/host, the narrower
/proc and /sys mounts preserved CPU, memory, network and disk-I/O measurements.
Proxy and containerd changes on other versions require new compatibility tests.

Verification: mock-daemon tests prove writes/file APIs are rejected without
reaching upstream and secret markers are removed. A temporary proxy/collector
trial validated metrics before deployment, then was removed. Live checks verify
403 for denied routes, stripped inspect data, private network membership and
collector mounts. Promtool's 26 rule scenarios pass with the new expected proxy
service. Proxy failure is also visible via Docker-state collection failure;
expected-container inventory depends on that collector and is not independent.

```bash
node --test monitoring/docker-api-proxy.test.mjs
docker compose -f docker-compose.prod.yml up -d --no-build --wait docker-api-proxy docker-state-exporter cadvisor
```

Sources: [cAdvisor Docker factory](https://github.com/google/cadvisor/blob/v0.60.6/container/docker/factory.go)
and [containerd client](https://github.com/google/cadvisor/blob/v0.60.6/lib/container/containerd/client.go).


## 18. Simple Backend CI

`.github/workflows/backend-ci.yml` runs on pushes, pull requests and manual
workflow dispatches. The Backend job uses Ubuntu and Node.js 22, matching the Dockerfile:

1. Install locked dependencies with `npm ci`.
2. Run ESLint without auto-fixing source (`npm run lint -- --no-fix`).
3. Run existing unit tests (`npm test -- --ci --runInBand`).
4. Compile the NestJS Backend (`npm run build`).
5. Build the production Dockerfile with a temporary CI image tag.

A failing step fails the job and skips later steps. No failures are ignored.
The job has read-only repository permissions, a 20-minute timeout and cancels
superseded runs on the same ref. It does not require Production secrets or a
running MySQL service for the existing unit tests. npm cache uses the Backend lockfile.

After committing/pushing the workflow and the required Dockerfile/Backend files,
open GitHub → Actions → Backend CI to inspect results. A local file alone does
not activate GitHub Actions. No commit or push was performed during setup.
This is validation only: no registry publishing or deployment. Browser integration
and live database/Socket.IO smoke tests remain separate from this unit-test job.

References: [checkout](https://github.com/actions/checkout) and
[setup-node](https://github.com/actions/setup-node). Scope follows DevOps Plan
section 34.1; registry publishing and automated staging are later steps.

Local validation on 2026-11-08: install, 26 unit suites/583 tests, NestJS build
and Docker build passed. Lint failed with 1416 errors and 153 warnings in the
current source. CI will therefore fail at lint until Backend owners address
those issues; later workflow steps are skipped. No GitHub-hosted run yet.


### Independent migration verification

The same workflow also has a `migrations` job, with no `needs` dependency on the
Backend job. It can run even while lint fails; any failed job still makes CI fail.
It starts a fresh MySQL 8.4 service using disposable CI-only credentials, waits
for a successful SQL healthcheck, installs dependencies, builds the Backend and
runs `npm run migration:run:prod` against that temporary database.

Verification fails if no compiled migrations are discovered, pending migrations
remain, the history count differs from the discovered migration count, the users
table cannot be queried, or running migrations again applies anything. It checks
fresh schema creation and no-op reruns, not upgrade compatibility with existing
Production data or rollback safety. GitHub removes the database service when the
job finishes. No Production credentials or database connections are used.

Service setup follows the [GitHub service container documentation](https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers).
