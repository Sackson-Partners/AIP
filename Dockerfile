FROM python:3.14-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.14-slim AS runtime

RUN groupadd -r aip && useradd -r -g aip -d /app -s /sbin/nologin aip

WORKDIR /app

COPY --from=builder /install /usr/local

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 bash \
    && rm -rf /var/lib/apt/lists/*

COPY backend/ ./backend/
COPY alembic/ ./alembic/
COPY alembic.ini ./alembic.ini
COPY start.sh ./start.sh

RUN chmod +x /app/start.sh && \
    test -f /app/alembic.ini && echo "OK alembic.ini" && \
    test -f /app/start.sh && echo "OK start.sh" && \
    test -f /app/backend/main.py && echo "OK main.py"

RUN chown -R aip:aip /app

USER aip

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    PYTHONPATH=/app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["/app/start.sh"]
