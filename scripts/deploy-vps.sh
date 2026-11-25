#!/usr/bin/env bash
# ------------------------------------------------------------------
# TaskPilot-WebApp — one-shot deployment script for a fresh Ubuntu VPS
#
#   curl -fsSL https://raw.githubusercontent.com/anasAboAli/TaskPilot-WebApp/main/scripts/deploy-vps.sh | bash
#   # or, after cloning:  bash scripts/deploy-vps.sh
#
# What it does:
#   1. Installs Git and Docker if they are missing
#   2. Clones (or updates) the repository
#   3. Builds the Docker image (tests run inside the build)
#   4. (Re)starts the container on port 80 -> 3000 with a data volume
# ------------------------------------------------------------------
set -euo pipefail

REPO_URL="https://github.com/anasAboAli/TaskPilot-WebApp.git"
APP_DIR="$HOME/TaskPilot-WebApp"
IMAGE="taskpilot-webapp"
CONTAINER="taskpilot"
HOST_PORT="${HOST_PORT:-80}"

SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"

echo "==> 1/4 Checking Git and Docker"
if ! command -v git >/dev/null 2>&1; then
  $SUDO apt-get update -y
  $SUDO apt-get install -y git
fi
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | $SUDO sh
  $SUDO systemctl enable --now docker
fi
git --version
$SUDO docker --version

echo "==> 2/4 Getting the source code"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

echo "==> 3/4 Building the image (runs the test suite)"
$SUDO docker build -t "$IMAGE" .

echo "==> 4/4 Starting the container"
$SUDO docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
$SUDO docker run -d --name "$CONTAINER" \
  --restart unless-stopped \
  -p "$HOST_PORT":3000 \
  -v taskpilot-data:/app/data \
  "$IMAGE"

sleep 5
$SUDO docker ps --filter "name=$CONTAINER"
curl -s "http://localhost:$HOST_PORT/health" && echo
echo "Done. Open: http://$(curl -s https://api.ipify.org 2>/dev/null || echo '<VPS_IP>'):$HOST_PORT"
