#!/bin/bash
set -e

echo "AIP API Starting..."

export DATABASE_URL=$(echo "$DATABASE_URL" | tr -d '"' | tr -d "'")

if echo "$DATABASE_URL" | grep -q "^postgres://"; then
    export DATABASE_URL=$(echo "$DATABASE_URL" | sed "s|postgres://|postgresql+psycopg2://|")
    echo "Fixed URL scheme"
fi

if echo "$DATABASE_URL" | grep -q "^postgresql://" && ! echo "$DATABASE_URL" | grep -q "psycopg2"; then
    export DATABASE_URL=$(echo "$DATABASE_URL" | sed "s|postgresql://|postgresql+psycopg2://|")
    echo "Fixed URL scheme 2"
fi

echo "Running migrations..."
cd /app && alembic upgrade head && echo "Migrations done" || echo "Migration warning - continuing"

echo "Starting Gunicorn..."
exec gunicorn backend.main:app \
    -k uvicorn.workers.UvicornWorker \
    --workers ${GUNICORN_WORKERS:-4} \
    --bind 0.0.0.0:${PORT:-8000} \
    --timeout 120 \
    --keep-alive 5 \
    --access-logfile - \
    --error-logfile -
