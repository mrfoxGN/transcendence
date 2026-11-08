.DEFAULT_GOAL := help
.NOTPARALLEL:
COMPOSE := docker compose -f docker-compose.prod.yml

.PHONY: help all up build update restart stop down clean fclean status logs check health backup

help:
	@printf '%s\n' 'make up       Start Production (images must already exist)' 'make build    Build the selected Backend image' 'make update   Build, migrate and replace Backend; brief downtime' 'make restart  Restart Backend using its current image' 'make status   Show Production services' 'make logs     Follow Backend and Nginx logs' 'make health   Check HTTPS health' 'make backup   Backup database/files; brief Backend downtime' 'make down     Remove this stack containers; keep volumes/images'

all: up

check:
	$(COMPOSE) config --quiet

up: check
	$(COMPOSE) up -d --no-build --wait --wait-timeout 120

build: check
	$(COMPOSE) build backend

# Choose a fresh BACKEND_IMAGE tag before update; do not overwrite release tags.
# A migration error stops this recipe with Backend stopped for investigation.
update: build
	$(COMPOSE) up -d --no-deps --no-build --wait --wait-timeout 120 mysql
	$(COMPOSE) stop backend
	$(COMPOSE) run --rm --no-deps -T migrate
	$(COMPOSE) up -d --no-deps --no-build --pull never --wait --wait-timeout 120 backend
	$(COMPOSE) exec -T nginx nginx -t
	$(COMPOSE) exec -T nginx nginx -s reload
	$(MAKE) health

restart: check
	$(COMPOSE) restart --no-deps backend
	$(COMPOSE) up -d --no-deps --no-build --pull never --wait --wait-timeout 120 backend
	$(COMPOSE) exec -T nginx nginx -t
	$(COMPOSE) exec -T nginx nginx -s reload
	$(MAKE) health

health:
	curl --fail --silent --show-error --cacert nginx/certs/fullchain.pem https://localhost/health
	@printf '\n'

status:
	$(COMPOSE) ps -a

logs:
	$(COMPOSE) logs --tail=100 -f backend nginx

backup:
	bash scripts/backup.sh

stop:
	$(COMPOSE) stop

down clean fclean:
	$(COMPOSE) down
