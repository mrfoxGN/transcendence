COMPOSE := docker compose --env-file .env -f devops/docker-compose.prod.yml

.PHONY: help all up build restart stop down clean fclean \
        status logs health backup restore clean-images re

help:
	@printf '%s\n' \
		'make up               Build images and start production' \
		'make build            Build Backend + Nginx (includes Frontend)' \
		'make restart          Stop and start production without rebuilding' \
		'make status           Show production services' \
		'make logs             Follow Backend and Nginx logs' \
		'make health           Check HTTPS health' \
		'make backup           Backup MySQL database' \
		'make restore BACKUP=backups/<date>   Restore a selected backup' \
		'make stop             Stop production containers' \
		'make down             Remove containers; preserve volumes/images' \
		'make clean            Same as make down' \
		'make fclean           Delete project containers, networks, volumes and service images' \
		'make re               Run fclean, then build and start again' \
		'make clean-images     Remove unused dangling images across Docker (asks for confirmation)'

all: up

build:
	$(COMPOSE) build backend nginx

up: build
	$(COMPOSE) up -d --no-build --remove-orphans --wait --wait-timeout 120

restart:
	$(COMPOSE) stop
	$(COMPOSE) up -d --no-build --wait --wait-timeout 120

health:
	curl -fsS --cacert devops/nginx/certs/fullchain.pem https://localhost/health
	@printf '\n'

status:
	$(COMPOSE) ps -a

logs:
	$(COMPOSE) logs --tail=100 -f backend nginx

backup:
	$(COMPOSE) exec -T backup /bin/bash /scripts/backup.sh

restore:
	@test -n "$(BACKUP)" || { echo "Usage: make restore BACKUP=backups/<date>" >&2; exit 2; }
	bash devops/scripts/restore.sh "$(BACKUP)"

stop:
	$(COMPOSE) stop

down:
	$(COMPOSE) down

clean: down

fclean:
	$(COMPOSE) down --volumes --rmi all --remove-orphans

re:
	$(MAKE) fclean
	$(MAKE) up

clean-images:
	docker image prune
