#!/usr/bin/env bash
# Build (และ optionally push) Docker image ของ SPA
# Usage: scripts/deploy-docker.sh [tag] [registry]
#   [tag]       image tag (default: git short SHA)
#   [registry]  เช่น 697697503013.dkr.ecr.ap-southeast-7.amazonaws.com — ถ้าให้มา จะ tag+push
# Run ตัวอย่าง (ดู docs/deploy.md):
#   docker run -p 3000:80 -e BACKEND_URL=https://backend -e X_APP_ID=<id> carmen-frontend:<tag>
set -euo pipefail

IMAGE="carmen-frontend"
TAG="${1:-$(git rev-parse --short HEAD)}"
REGISTRY="${2:-}"

docker build -t "${IMAGE}:${TAG}" -t "${IMAGE}:latest" .

if [ -n "${REGISTRY}" ]; then
  docker tag "${IMAGE}:${TAG}" "${REGISTRY}/${IMAGE}:${TAG}"
  docker tag "${IMAGE}:${TAG}" "${REGISTRY}/${IMAGE}:latest"
  docker push "${REGISTRY}/${IMAGE}:${TAG}"
  docker push "${REGISTRY}/${IMAGE}:latest"
  echo "Pushed ${REGISTRY}/${IMAGE}:${TAG} (+latest)"
else
  echo "Built ${IMAGE}:${TAG} (+latest) — pass a registry arg to push"
fi
