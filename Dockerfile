FROM python:3.11-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.11-slim AS runtime

RUN groupadd -r aip && useradd -r -g aip -d /app -s /sbin/nologin aip

WORKDIR /app

COPY --from=builder /install /usr/local

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy application code
COPY backend/ ./backend/

# Copy alembic migrations (CRITICAL - was missing before)
COPY alembic/ ./alembic/
COPY alembic.ini ./alembic.ini

# Verify all critical files exist at build time
RUN echo "=== Build verification ===" && \
    test -f /app/alembic.ini       && echo "✅ alembic.ini" || (echo "❌ alembic.ini MISSING" && exit 1) && \
    test -d /app/alembic/versions  && echo "✅ alembic/versions/" || (echo "❌ alembic/versions MISSING" && exit 1) && \
    test -f /app/backend/main.py   && echo "✅ backend/main.py" || (echo "❌ backend/main.py MISSING" && exit 1) && \
    test -f /app/backend/database.py && echo "✅ backend/database.py" || (echo "❌ backend/database.py MISSING" && exit 1) && \
    echo "Migration files:" && ls /app/alembic/versions/

RUN chown -R aip:aip /app

USER aip

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    PYTHONPATH=/app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["sh", "-c", "\
    echo '🚀 AIP API Starting...' && \
    echo "DB: ${DATABASE_URL:0:50}" && \
    export DATABASE_URL=$(echo "$DATABASE_URL" | tr -d '"' | tr -d "'") && \
    if echo "$DATABASE_URL" | grep -q '^postgres://'; then \
        export DATABASE_URL=$(echo "$DATABASE_URL" | sed 's|postgres://|postgresql+psycopg2://|'); \
        echo '✅ Fixed: postgres:// → postgresql+psycopg2://'; \
    fi && \
    if echo "$DATABASE_URL" | grep -q '^postgresql://' && ! echo "$DATABASE_URL" | grep -q 'psycopg2'; then \
        export DATABASE_URL=$(echo "$DATABASE_URL" | sed 's|postgresql://|postgresql+psycopg2://|'); \
        echo '✅ Fixed: postgresql:// → postgresql+psycopg2://'; \
    fi && \
    echo '📦 Running database migrations...' && \
    cd /app && alembic upgrade head && echo '✅ Migrations complete' || echo '⚠️  Migration warning - continuing' && \
    echo '🌐 Starting Gunicorn...' && \
    exec gunicorn backend.main:app \
        -k uvicorn.workers.UvicornWorker \
        --workers ${GUNICORN_WORKERS:-4} \
        --bind 0.0.0.0:${PORT:-8000} \
        --timeout 120 \
        --keep-alive 5 \
        --access-logfile - \
        --error-logfile -"]
