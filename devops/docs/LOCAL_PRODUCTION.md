# Local production deployment

This guide describes the current `devops/docker-compose.prod.yml` stack. Run commands
from the repository root. Pass `--env-file .env` when using Compose directly. The same Compose file can be used on another host by
setting the host and port values in `.env`; commands and URLs below use the
localhost defaults unless stated otherwise.

## 1. Configure `.env`

Copy the example only if `.env` does not exist:

```bash
cp -n devops/.env.example .env
```

Set `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `JWT_SECRET`,
`GRAFANA_ADMIN_PASSWORD`, and `GRAFANA_SECRET_KEY`. Generate independent values
for secrets, for example with `openssl rand -hex 32`. Never commit `.env`.
`PUBLIC_HOST`, `BIND_IP`, `HTTP_PORT`, `HTTPS_PORT`, and `GATUS_PORT` select the
host-facing addresses; see `devops/docker-compose.prod.yml` for their defaults.
`BACKUP_TZ` selects the daily backup timezone and defaults to
`Africa/Casablanca`. `BACKEND_IMAGE` selects the image shared by Backend and
migrations.

MySQL's initial database and account are created only when its data volume is
first initialized. Changing their passwords in `.env` later does not change
existing MySQL accounts. Coordinate credential rotation without deleting data.
GitHub OAuth and token variables are optional until those features are used.

## 2. Start and verify

```bash
docker compose --env-file .env -f devops/docker-compose.prod.yml config --quiet
make up
make status
```

`make up` builds missing Backend and Nginx images and starts the stack. Nginx's
image includes the compiled Frontend files; there is no separate Production
Frontend container. MySQL
must become healthy before `migrate` runs. The one-shot `migrate` service runs
compiled TypeORM migrations and exits with code 0. Backend starts after that;
Nginx waits for Backend health and certificate preparation. On an existing
installation, `make up` removes the obsolete Frontend container with
`--remove-orphans`, preserving named volumes. The `backup` service also
starts after migration and makes its first snapshot at startup.

The `cert-init` service creates a self-signed certificate for `PUBLIC_HOST`, or
keeps a matching certificate with at least 30 days remaining. The certificate
and key live in the ignored `devops/nginx/certs/` directory. A self-signed certificate
requires explicit trust in browsers and HTTPS clients. For a publicly trusted
certificate, supply one through the deployment's certificate procedure.

With the default localhost host and ports:

```bash
curl --cacert devops/nginx/certs/fullchain.pem https://localhost/health
curl -I http://localhost/health
```

The first command should return `{"status":"ok","service":"backend"}`;
HTTP redirects to HTTPS. Use the configured host and ports if you changed
`.env`. `/health` is a Backend liveness check, not a database query. Verify a
real application operation such as login when database connectivity matters.

Nginx is the only service publishing host ports. Its application HTTPS port
serves Frontend at `/`, Backend routes such as `/api/`, `/auth/`, `/github/`,
`/health`, and `/socket.io/`, and Grafana at `/grafana/`. It redirects `/status`
to Gatus on the separately published HTTPS `GATUS_PORT` (default `8443`).
Backend, MySQL, Prometheus, and the exporters have no direct host ports.

## 3. Services and data

| Service | Role |
| --- | --- |
| `mysql` | Stores application database data in `mysql_data`. |
| `migrate` | Runs TypeORM migrations once at container startup, then exits. |
| `backend` | Runs the API and writes uploaded files to `backend_storage`. |
| `nginx` | Serves the built Frontend files directly and handles HTTPS, redirects, API and WebSocket routing. |
| `cert-init` | Prepares the TLS certificate, then exits. |
| `backup` | Saves MySQL snapshots to the host `./backups/` directory. |
| `prometheus` | Collects metrics and stores them in `prometheus_data`. |
| `grafana` | Displays the provisioned dashboard and stores its local state in `grafana_data`. |
| `node-exporter` | Exposes Linux host CPU, RAM, and filesystem metrics. |
| `cadvisor` | Exposes Docker container resource metrics. |
| `status-page` | Runs Gatus checks for Backend, Frontend, and MySQL. |

The Compose project is named `transcendence-prod`. Its four named volumes are
`mysql_data`, `backend_storage`, `prometheus_data`, and `grafana_data` (prefixed
by the project name in Docker). They persist across container recreation and
`docker compose down`. They are not backups. `./backups/` is a host directory,
not a named volume; it is ignored by Git. Protect it because it contains user
data. Do not use `down -v` when retaining application data.

For backup timing, verification, restore and its limitations, follow
[Backup and restore](BACKUP_AND_RESTORE.md). The current service takes a
snapshot at startup and then daily at 03:00 in `BACKUP_TZ` while running. The
backup is local only; snapshots older than seven days are removed after successful backups. Notification delivery is not configured.

## 4. Monitoring and alerts

Open `https://localhost/grafana/` with the Grafana administrator credentials
from `.env`. If the host or HTTPS port differs, use those configured values.
The provisioned dashboard is **DevUP Monitoring** at
`/grafana/d/devup-devops/monitoring/`. Its seven panels show host CPU, host RAM, host
root disk usage, per-service container RAM, per-service container CPU, Docker
network traffic, and Prometheus scrape-target status. It refreshes every 15
seconds and initially shows the last hour. The dashboard source is
`devops/monitoring/dashboards/devup-monitoring.json`; its provisioning and datasource
files are in `devops/monitoring/`. Persistent dashboard changes should be made in the
source JSON.

Prometheus scrapes itself, Node Exporter, and cAdvisor every 15 seconds, as
specified by `devops/monitoring/prometheus.yml`. It retains samples for seven days by
time; no separate size limit is configured. Grafana queries Prometheus over the
internal monitoring network. The dashboard's `up` panel reports scrape-target
reachability; it does not prove Backend, Frontend, or MySQL application health.
Gatus separately checks `http://backend:3000/health`, `https://nginx:443/`,
and the MySQL TCP port every 30 seconds. The internal Frontend check skips
certificate verification because its Docker hostname is `nginx` while the
self-signed certificate identifies `PUBLIC_HOST`. External clients should
still verify the certificate as shown above. A successful TCP connection does not
prove that the Backend can execute a database query.

`devops/monitoring/alerts.yml` currently contains three Prometheus rules:

| Rule | Condition | Pending period |
| --- | --- | --- |
| `HighCPUUsage` | Average host CPU usage above 80% | 5 minutes |
| `HighMemoryUsage` | Host RAM usage above 85% | 5 minutes |
| `HighDiskUsage` | Host root filesystem usage above 85% | 5 minutes |

They use Node Exporter host metrics, which include other workloads on the same
machine. View their state in Grafana under **Alerting → Alert rules**, or in
Prometheus. These are Prometheus rules; Grafana-managed rules and email or
external notification delivery are not configured. The rules do not cover API
error rates, application failures, individual container restarts, or backup
failures. Validate rule syntax with:

```bash
docker compose --env-file .env -f devops/docker-compose.prod.yml exec -T prometheus promtool check rules /etc/prometheus/alerts.yml
```

Gatus gives a separate status page on `https://localhost:8443/` by default.
It reports the three configured endpoint checks; its configuration is
`devops/monitoring/status/config.yaml`. It does not replace application-level tests.

## 5. Routine operations

```bash
make status
make logs
make health
make backup
```

`make logs` follows Backend and Nginx logs. Static Frontend requests appear in
Nginx logs. To inspect a particular
service, use `docker compose --env-file .env -f devops/docker-compose.prod.yml logs --tail=100 SERVICE`.
The current Compose file does not configure per-container log rotation. Nginx writes access logs to stdout using the currently configured format in
`devops/nginx/nginx.conf.template`. Do not assume query parameters are redacted.
Backend logging remains owned by the Backend team.

`make restart` restarts Backend, reloads Nginx, and verifies HTTPS health.
`make update` rebuilds Backend, runs migrations and replaces it;
`make update-frontend` rebuilds and replaces the single Nginx container with
the new Frontend files. This briefly interrupts both Frontend and proxied API
connections while Nginx is replaced. The Backend container and data volumes
are preserved. Production uses `devops/docker/frontend.Dockerfile` and
`devops/nginx/nginx.conf.template`, with one Nginx container. There are no separate Frontend-specific Nginx configurations or
TLS entrypoint scripts. Follow
[Release and rollback](RELEASE_AND_ROLLBACK.md) before versioned releases or
database schema changes. `make restore BACKUP=backups/TIMESTAMP` restores the
selected local snapshot after confirmation; see the backup guide before using
it. `make down`, `make clean`, and `make fclean` remove this Compose project's
containers and networks while preserving named volumes.

This guide records the current configuration, not a guarantee that every
feature has passed an end-to-end test on a new host. Verify HTTPS, login,
Frontend flows, backup archives, and restore against the deployment you run.
