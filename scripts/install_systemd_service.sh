#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="jobscroll.service"
TARGET_PATH="/etc/systemd/system/${SERVICE_NAME}"
RUN_USER="${1:-$USER}"
TMP_UNIT="$(mktemp)"

sed \
  -e "s|^User=.*|User=${RUN_USER}|" \
  -e "s|^WorkingDirectory=.*|WorkingDirectory=${APP_DIR}|" \
  -e "s|^ExecStart=.*|ExecStart=/bin/bash ${APP_DIR}/scripts/start_server_linux.sh|" \
  "${APP_DIR}/deploy/jobscroll.service" > "${TMP_UNIT}"

sudo cp "${TMP_UNIT}" "${TARGET_PATH}"
rm -f "${TMP_UNIT}"

sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl status "${SERVICE_NAME}" --no-pager
