.DEFAULT_GOAL := help
.NOTPARALLEL:

COMPOSE := docker compose -f docker-compose.prod.yml
BACKEND_IMAGE ?= transcendence-backend:prod

.PHONY: help all up build update restart stop down clean fclean status logs check health backup

help:
	@printf '%s\n' \
		'make up       Start production (build backend if missing)' \
		'make build    Build the backend image' \
		'make update   Build, migrate and replace backend' \
		'make restart  Restart backend using current image' \
		'make status   Show production services' \
		'make logs     Follow backend and Nginx logs' \
		'make health   Check HTTPS health' \
		'make backup   Backup database/files' \
		'make stop     Stop production containers' \
		'make down     Remove containers; keep volumes/images'

all: up

# Validate Docker Compose configuration
check:
	$(COMPOSE) config --quiet

# Build backend image
build: check
	$(COMPOSE) build backend

# Start production
# Build backend automatically if its image is missing
up: check
	@if ! docker image inspect $(BACKEND_IMAGE) >/dev/null 2>&1; then \
		echo "Backend image not found. Building..."; \
		$(COMPOSE) build backend || exit 1; \
	fi
	$(COMPOSE) up -d --no-build --wait --wait-timeout 120

# Update production backend
update: build
	$(COMPOSE) up -d --no-deps --no-build --wait --wait-timeout 120 mysql
	$(COMPOSE) stop backend
	$(COMPOSE) run --rm --no-deps -T migrate
	$(COMPOSE) up -d --no-deps --no-build --pull never --wait --wait-timeout 120 backend
	$(COMPOSE) exec -T nginx nginx -t
	$(COMPOSE) exec -T nginx nginx -s reload
	$(MAKE) health

# Restart backend
restart: check
	$(COMPOSE) restart --no-deps backend
	$(COMPOSE) up -d --no-deps --no-build --pull never --wait --wait-timeout 120 backend
	$(COMPOSE) exec -T nginx nginx -t
	$(COMPOSE) exec -T nginx nginx -s reload
	$(MAKE) health

# Check HTTPS health
health:
	curl --fail --silent --show-error \
		--cacert nginx/certs/fullchain.pem \
		https://localhost/health
	@printf '\n'

# Show container status
status:
	$(COMPOSE) ps -a

# Follow logs
logs:
	$(COMPOSE) logs --tail=100 -f backend nginx

# Database backup
backup:
	bash scripts/backup.sh

# Stop services
stop:
	$(COMPOSE) stop

# Remove containers and networks (preserve volumes)
down clean fclean:
	$(COMPOSE) down