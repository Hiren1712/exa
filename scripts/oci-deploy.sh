#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/opt/exa
ENV_FILE="${APP_DIR}/.env.oci"
TUNNEL_TOKEN_FILE="${APP_DIR}/.cloudflare-tunnel-token"
COMPOSE_FILE="${APP_DIR}/docker-compose.oci.yml"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo: sudo exa-deploy" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}; copy the private .env.oci file to the VM first." >&2
  exit 1
fi

if [[ ! -s "${TUNNEL_TOKEN_FILE}" ]]; then
  echo "Missing ${TUNNEL_TOKEN_FILE}; install the private Cloudflare Tunnel token first." >&2
  exit 1
fi

chmod 600 "${ENV_FILE}"
chmod 600 "${TUNNEL_TOKEN_FILE}"
cd "${APP_DIR}"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --build

for attempt in $(seq 1 36); do
  if docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T backend \
    curl -fsS http://localhost:8080/api/actuator/health >/dev/null; then
    echo "EXA backend is healthy."
    exit 0
  fi
  sleep 5
done

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" logs --tail=100 backend mysql
echo "Backend failed its health check; inspect the logs above." >&2
exit 1
