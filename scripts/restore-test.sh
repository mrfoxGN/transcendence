#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
if [[ $# -ne 2 ]]; then
    echo "Usage: $0 BACKUP_DIRECTORY transcendence-restore-NAME" >&2
    exit 1
fi
backup_dir=$(cd -- "$1" && pwd)
project=$2

# This script restores into a NEW isolated stack, never the running production stack.
if [[ ! "$project" =~ ^transcendence-restore-[a-z0-9][a-z0-9_-]*$ ]]; then
    echo "The project name must start with transcendence-restore-." >&2
    exit 1
fi
COMPOSE=(docker compose --project-directory "$ROOT" -f "$ROOT/docker-compose.prod.yml" -p "$project")

if [[ -n "$("${COMPOSE[@]}" ps -a -q)" ]]; then
    echo "This project already has containers; choose a new project name." >&2
    exit 1
fi
for volume in "${project}_mysql_data" "${project}_backend_storage"; do
    if docker volume inspect "$volume" > /dev/null 2>&1; then
        echo "Volume $volume already exists; choose a new project name." >&2
        exit 1
    fi
done

(
    cd "$backup_dir"
    sha256sum --check SHA256SUMS
)
gzip -t "$backup_dir/database.sql.gz"
tar -tzf "$backup_dir/files.tar.gz" > /dev/null

# Resolve the same image Compose will actually run, including BACKEND_IMAGE.
# Capture only its name; never print the full config containing credentials.
backend_image=$("${COMPOSE[@]}" config --format json | python3 -c \
    'import json, sys; print(json.load(sys.stdin)["services"]["backend"]["image"])')
if [[ "$(docker image inspect "$backend_image" --format '{{.Id}}')" != "$(cat "$backup_dir/backend-image.txt")" ]]; then
    echo "The backend image differs from the backup. Use the matching image before restoring." >&2
    exit 1
fi
if [[ "$(docker image inspect mysql:8.4 --format '{{.Id}}')" != "$(cat "$backup_dir/mysql-image.txt")" ]]; then
    echo "The MySQL image differs from the backup. Use the matching image before restoring." >&2
    exit 1
fi

"${COMPOSE[@]}" up -d --no-build --pull never --wait --wait-timeout 120 mysql
gzip -dc "$backup_dir/database.sql.gz" | "${COMPOSE[@]}" exec -T mysql sh -c '
    export MYSQL_PWD="$MYSQL_PASSWORD"
    exec mysql --user="$MYSQL_USER" "$MYSQL_DATABASE"
'

"${COMPOSE[@]}" run --rm --no-deps -T --entrypoint tar backend \
    -xzf - -C /app/storage < "$backup_dir/files.tar.gz"

# Nginx is intentionally excluded: this stack does not publish any host ports.
"${COMPOSE[@]}" up -d --no-build --pull never --wait --wait-timeout 120 mysql migrate backend
"${COMPOSE[@]}" exec -T backend node -e '
    const { AppDataSource } = require("./dist/database/data-source.js");
    (async () => {
        await AppDataSource.initialize();
        try {
            if (await AppDataSource.showMigrations()) {
                throw new Error("Pending migrations after restore");
            }
            await AppDataSource.query("SELECT 1 FROM users LIMIT 1");
            console.log("Restored database is reachable and migrations are current.");
        } finally {
            await AppDataSource.destroy();
        }
    })().catch(error => { console.error(error.message); process.exit(1); });
'

echo "Restore ready in isolated project: $project"
echo "Production data was not overwritten. Inspect restored data before removing the test stack."
