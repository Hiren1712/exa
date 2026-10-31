#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo: sudo bash scripts/oci-bootstrap.sh" >&2
  exit 1
fi

if ! grep -qiE 'ubuntu|debian' /etc/os-release; then
  echo "This bootstrap script supports Ubuntu and Debian OCI images." >&2
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

if [[ ! -d /opt/exa/.git ]]; then
  git clone --depth 1 https://github.com/Hiren1712/exa.git /opt/exa
fi

install -d -m 0750 /opt/exa
install -m 0755 /opt/exa/scripts/oci-deploy.sh /usr/local/bin/exa-deploy

echo "Bootstrap complete. Copy .env.oci and .cloudflare-tunnel-token to /opt/exa/, then run: sudo exa-deploy"
