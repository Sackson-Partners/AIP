# Dockerfile for Azure Container Apps deployment (Python backend)
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# AIP Platform - Multi-stage Dockerfile
# Target: Azure Container Apps / sacksons/aip-api on Docker Hub

FROM python:3.11-slim AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.11-slim AS runtime
RUN groupadd -r aip && useradd -r -g aip -d /app -s /sbin/nologin aip
WORKDIR /app
COPY --from=builder /install /usr/local
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 && rm -rf /var/lib/apt/lists/*
COPY backend/ ./backend/
RUN chown -R aip:aip /app
USER aip
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8000 PYTHONPATH=/app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1
    CMD ["sh", "-c", "gunicorn -k uvicorn.workers.UvicornWorker --workers ${GUNICORN_WORKERS:-4} --bind 0.0.0.0:${PORT:-8000} --timeout 120 --access-logfile - --error-logfile - backend.main:app"]# Environment flags
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Install system dependencies (needed for psycopg2)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer caching = faster rebuilds)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ ./backend/

# Expose port
EXPOSE 8000

# Production startup: gunicorn + uvicorn workers
CMD ["bash", "-lc", "gunicorn -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:${PORT} backend.main:app"]
