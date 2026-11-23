#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env}"

# Never overwrite an existing .env
if [[ -e "$ENV_FILE" ]]; then
    echo "Error: $ENV_FILE already exists."
    echo "Back it up or choose a different filename."
    exit 1
fi

umask 077

random_secret() {
    openssl rand -hex 32
}

random_base64() {
    openssl rand -base64 32 | tr -d '\n'
}

cat > "$ENV_FILE" <<EOF
# Application
NODE_ENV=production
APP_PORT=3000

# Docker image
BACKEND_IMAGE=transcendence-backend:prod

# Database
DB_HOST=mysql
DB_PORT=3306
DB_NAME=transcendence
DB_USER=transcendence
DB_PASSWORD=$(random_secret)
DB_ROOT_PASSWORD=$(random_secret)

# JWT
JWT_SECRET=$(random_secret)

# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=$(random_secret)
GRAFANA_SECRET_KEY=$(random_secret)

# MySQL monitoring
MYSQL_EXPORTER_PASSWORD=$(random_secret)

# GitHub OAuth
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
GITHUB_OAUTH_CALLBACK_URL=

# GitHub token encryption
GITHUB_TOKEN_ENCRYPTION_KEY=$(random_base64)
EOF

chmod 600 "$ENV_FILE"

echo "✅ Created $ENV_FILE with secure random secrets."
echo "🔒 File permissions: 600"