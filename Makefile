.DEFAULT_GOAL := help
.NOTPARALLEL:

COMPOSE := docker compose -f docker-compose.prod.yml

.PHONY: help all check up build build-backend build-frontend \
        update update-frontend restart stop down clean fclean \
        status logs health backup restore

# ==========================================
# HELP
# ==========================================

help:
	@printf '%s\n' \
		'make up               Start production (build missing images)' \
		'make build            Build Backend + Frontend' \
		'make build-backend    Build Backend image' \
		'make build-frontend   Build Frontend image' \
		'make update           Build, migrate and deploy Backend' \
		'make update-frontend  Build and deploy Frontend' \
		'make restart          Restart Backend' \
		'make status           Show production services' \
		'make logs             Follow Backend, Frontend and Nginx logs' \
		'make health           Check HTTPS health' \
		'make backup           Backup database/files' \
		'make restore BACKUP=backups/<date>   Restore a selected backup' \
		'make stop             Stop production containers' \
		'make down             Remove containers; preserve volumes/images'

all: up

# ==========================================
# VALIDATION
# ==========================================

check:
	$(COMPOSE) config --quiet

# ==========================================
# BUILD
# ==========================================

build: check
	$(COMPOSE) build backend frontend

build-backend: check
	$(COMPOSE) build backend

build-frontend: check
	$(COMPOSE) build frontend

# ==========================================
# START PRODUCTION
# ==========================================

# Automatically build missing images.
# Read image names from the resolved Compose configuration
# so that custom release tags are supported.

up: check
	@set -e; \
	for service in backend frontend; do \
		image=$$($(COMPOSE) config --format json | \
			python3 -c 'import json,sys; c=json.load(sys.stdin); print(c["services"][sys.argv[1]]["image"])' "$$service"); \
		if ! docker image inspect "$$image" >/dev/null 2>&1; then \
			echo "Image $$image not found. Building $$service..."; \
			$(COMPOSE) build "$$service"; \
		else \
			echo "Image $$image already exists."; \
		fi; \
	done
	$(COMPOSE) up -d --no-build --wait --wait-timeout 120

# ==========================================
# BACKEND UPDATE
# ==========================================

update: build-backend
	$(COMPOSE) up -d --no-deps --no-build --wait --wait-timeout 120 mysql
	$(COMPOSE) stop backend
	$(COMPOSE) run --rm --no-deps -T migrate
	$(COMPOSE) up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 120 backend
	$(COMPOSE) exec -T nginx nginx -t
	$(COMPOSE) exec -T nginx nginx -s reload
	$(MAKE) health

# ==========================================
# FRONTEND UPDATE
# ==========================================

update-frontend: build-frontend
	$(COMPOSE) up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 120 frontend
	$(COMPOSE) exec -T frontend nginx -t
	$(COMPOSE) exec -T nginx nginx -t
	$(COMPOSE) exec -T nginx nginx -s reload
	curl --fail --silent --show-error \
		--cacert nginx/certs/fullchain.pem \
		https://localhost/ >/dev/null
	@echo "Frontend deployment successful."

# ==========================================
# RESTART BACKEND
# ==========================================

restart: check
	$(COMPOSE) restart --no-deps backend
	$(COMPOSE) up -d --no-deps --no-build --pull never --wait --wait-timeout 120 backend
	$(COMPOSE) exec -T nginx nginx -t
	$(COMPOSE) exec -T nginx nginx -s reload
	$(MAKE) health

# ==========================================
# HEALTH CHECK
# ==========================================

health:
	curl --fail --silent --show-error \
		--cacert nginx/certs/fullchain.pem \
		https://localhost/health
	@printf '\n'

# ==========================================
# STATUS
# ==========================================

status:
	$(COMPOSE) ps -a

# ==========================================
# LOGS
# ==========================================

logs:
	$(COMPOSE) logs --tail=100 -f backend frontend nginx

# ==========================================
# BACKUP
# ==========================================

backup:
	bash scripts/backup.sh

restore:
	@test -n "$(BACKUP)" || { echo "Usage: make restore BACKUP=backups/<date>" >&2; exit 2; }
	bash scripts/restore.sh "$(BACKUP)"

# ==========================================
# STOP
# ==========================================

stop:
	$(COMPOSE) stop

# ==========================================
# REMOVE CONTAINERS
# ==========================================

down clean fclean:
	$(COMPOSE) down