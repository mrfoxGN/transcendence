#!/usr/bin/env bash

set -euo pipefail

echo "======================================"
echo "       DOCKER FULL RESET"
echo "======================================"

echo ""
echo "WARNING: This will DELETE:"
echo "- All Docker containers"
echo "- All Docker images"
echo "- All Docker volumes (including databases)"
echo "- All unused Docker networks"
echo "- All Docker build cache"
echo ""

read -r -p "Type DELETE ALL to continue: " confirm

if [[ "$confirm" != "DELETE ALL" ]]; then
    echo "Cancelled."
    exit 1
fi

echo ""
echo "[1/5] Stopping and removing containers..."

docker ps -aq | xargs -r docker rm -f

echo ""
echo "[2/5] Removing Docker images..."

docker image ls -aq | sort -u | xargs -r docker rmi -f

echo ""
echo "[3/5] Removing Docker volumes..."

docker volume ls -q | xargs -r docker volume rm -f

echo ""
echo "[4/5] Removing unused Docker networks..."

docker network prune -f

echo ""
echo "[5/5] Removing Docker build cache..."

docker builder prune -af

echo ""
echo "======================================"
echo "       DOCKER RESET COMPLETE"
echo "======================================"

docker system df