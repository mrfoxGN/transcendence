all :
	docker compose up -d --build

clean :
	docker rm -f $(docker ps -aq)
	docker image rm -f $(docker image ls -aq)
	
fclean :
	docker rm -f $$(docker ps -aq) 2>/dev/null || true
	docker image rm -f $$(docker image ls -aq) 2>/dev/null || true
	docker volume rm -f $$(docker volume ls -q) 2>/dev/null || true
	docker system prune -af --volumes
	