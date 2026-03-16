"""API routers for AIP Platform."""
from .auth import router as auth_router
from .users import router as users_router
from .organizations import router as organizations_router
from .projects import router as projects_router
from .documents import router as documents_router
from .verifications import router as verifications_router
from .investors import router as investors_router
from .dealrooms import router as dealrooms_router
from .events import router as events_router

__all__ = [
    "auth_router",
    "users_router",
    "organizations_router",
    "projects_router",
    "documents_router",
    "verifications_router",
    "investors_router",
    "dealrooms_router",
    "events_router",
]
