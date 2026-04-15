#!/usr/bin/with-contenv bashio
# Inventar add-on entry script
# - Ensures /data exists
# - Runs alembic migrations (idempotent)
# - Starts FastAPI on 0.0.0.0:8099
set -e

mkdir -p /data

cd /app/backend
export PYTHONPATH=/app/backend

# Run DB migrations (safe on first boot and every restart)
alembic upgrade head

# Start FastAPI bound to all interfaces so both HA ingress and direct 8099/tcp work
exec uvicorn main:app --host 0.0.0.0 --port 8099
