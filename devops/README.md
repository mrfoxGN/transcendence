# DevOps layout

Run operational commands from the **repository root**. The root Makefile includes
`devops/Makefile`, which uses the root `.env` explicitly.

```text
devops/
  docker-compose.prod.yml
  Makefile
  .env.example
  docker/
    backend.Dockerfile
    frontend.Dockerfile
  nginx/
    nginx.conf
    certs/                  # local, ignored
  monitoring/               # Prometheus, Grafana, Gatus
  scripts/                  # backup, restore, certificates and utilities
  docs/                     # operating guides and historical reports
```

Outside this folder:

- `Makefile`: small entry point for existing `make` commands.
- `.env`: private runtime settings; never committed.
- `backups/`: existing local MySQL snapshots; never committed or moved by this reorganization.
- `.github/workflows/`: GitHub requires this location to discover CI.
- `apps/*/.dockerignore`: exclusions applied to each application build context.
- Application source, TypeORM DataSource and migrations stay owned by the application.

## Commands

```sh
cp -n devops/.env.example .env    # only when configuring a new checkout
make help
make build
make up
make restart
make status
make health
make backup
make restore BACKUP=backups/YYYY-MM-DD_HH-MM-SS_UTC
make down
```

Run Make commands from the repository root. `make up` builds Backend and Nginx
once, then starts the services without another build. Migrations reuse the
Backend image, avoiding concurrent builds of the same tag.

`make restart` stops and starts the stack without rebuilding. `make clean` is
an alias for `make down`; both preserve volumes and images. **`make fclean`
deletes project volumes and service images, including database and uploaded-file
data. `make re` runs `fclean` before building and starting again.** Host files
such as `.env`, certificates and `backups/`, and Docker build cache are preserved.
`make clean-images` asks Docker to prune unused dangling images across the host.

For direct Compose usage, specify both paths from the repository root:

```sh
docker compose --env-file .env -f devops/docker-compose.prod.yml ps
```

Build the Backend alone:

```sh
docker build -f devops/docker/backend.Dockerfile -t transcendence-backend:test apps/backend
```

Build the Frontend/Nginx alone:

```sh
docker build -f devops/docker/frontend.Dockerfile -t transcendence-nginx:test apps/frontend
```

Compose uses application directories as build contexts. Its relative bind mounts
resolve from `devops/`. The project name remains `transcendence-prod`, so named
volumes keep their existing names. Moving files does not rename or reset data volumes.

`docker-reset.sh` is a legacy **host-wide destructive** utility, not a deployment
step. It is not called by Make or Compose. Never run it to apply this layout.

See [local production](docs/LOCAL_PRODUCTION.md),
[backup and restore](docs/BACKUP_AND_RESTORE.md) and
[release/rollback](docs/RELEASE_AND_ROLLBACK.md).
Dated progress and audit reports describe historical configurations; their old
paths and features are not current operating instructions.

## Localhost-only deployment

Nginx binds its published ports only to `127.0.0.1`. Host/IP selection via
`PUBLIC_HOST` or `BIND_IP` is no longer supported. TLS certificates identify
localhost and 127.0.0.1. Grafana and Nginx redirects use localhost. Ports are fixed at 80, 443 and 8443 and cannot be changed through `.env`.
GitHub OAuth must use a matching localhost callback registered in the provider.

Nginx reads `/etc/nginx/nginx.conf` directly using the image's default startup.
No template generation, `envsubst`, or custom Nginx startup command is needed.
