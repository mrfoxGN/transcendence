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
    backend.dev.Dockerfile
    frontend.Dockerfile
  nginx/
    nginx.conf.template
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
make check
make build
make up
make status
make health
make backup
make restore BACKUP=backups/YYYY-MM-DD_HH-MM-SS_UTC
make down
```

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
