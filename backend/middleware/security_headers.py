"""
Security headers middleware for the AIP FastAPI backend.

Uses a pure ASGI implementation (no BaseHTTPMiddleware) to avoid Starlette's
response-body buffering, which adds latency and memory overhead on every response.
"""

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Receive, Scope, Send

_SECURITY_HEADERS = [
    ("X-Content-Type-Options",  "nosniff"),
    ("X-Frame-Options",          "DENY"),
    ("Referrer-Policy",          "strict-origin-when-cross-origin"),
    ("Permissions-Policy",       "camera=(), microphone=(), geolocation=()"),
    ("Strict-Transport-Security","max-age=63072000; includeSubDomains; preload"),
]


class SecurityHeadersMiddleware:
    """Injects security headers into every HTTP response with zero buffering."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_security_headers(message: dict) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for name, value in _SECURITY_HEADERS:
                    headers.append(name, value)
            await send(message)

        await self.app(scope, receive, send_with_security_headers)
