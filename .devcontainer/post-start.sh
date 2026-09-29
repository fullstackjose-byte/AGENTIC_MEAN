#!/usr/bin/env bash
set -euo pipefail

PID_FILE="/tmp/helpdesk-dev.pid"
LOG_FILE="/tmp/helpdesk-dev.log"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "[helpdesk] Angular y NestJS ya están ejecutándose."
  exit 0
fi

nohup pnpm dev >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"

echo "[helpdesk] Servicios iniciados automáticamente."
echo "[helpdesk] Angular: http://localhost:4200"
echo "[helpdesk] API:     http://localhost:3000/api/v1/health"
echo "[helpdesk] Logs:    tail -f $LOG_FILE"
