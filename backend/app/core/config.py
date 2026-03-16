"""Application configuration using Pydantic Settings."""
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Application
    ENVIRONMENT: str = "development"
    APP_NAME: str = "AIP Platform"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite:///./aip_platform.db"

    # Security
    JWT_SECRET: str = "your-256-bit-secret-key-change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8000,https://aip-plum.vercel.app,https://aip-env-aip-sacksons-projects.vercel.app"

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""  # Legacy HS256 secret from Supabase JWT Keys settings

    # Azure Storage
    AZURE_STORAGE_CONNECTION_STRING: Optional[str] = None
    AZURE_STORAGE_CONTAINER_NAME: str = "aip-uploads"

    # AWS S3
    S3_BUCKET: str = ""
    S3_REGION: str = "us-east-1"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_ENDPOINT_URL: str = ""

    # Blockchain
    CHAIN_RPC_URL: str = "https://polygon-rpc.com"
    CHAIN_ID: int = 137
    CONTRACT_ADDRESS: str = "0x0000000000000000000000000000000000000000"
    CHAIN_PRIVATE_KEY: str = ""

    # Integrations (set to enable)
    AIRTABLE_API_KEY: str = ""
    AIRTABLE_BASE_ID: str = ""
    MICROSOFT_TEAMS_CLIENT_ID: str = ""
    MICROSOFT_TEAMS_CLIENT_SECRET: str = ""
    MICROSOFT_TEAMS_TENANT_ID: str = ""
    DOCUSIGN_INTEGRATION_KEY: str = ""
    DOCUSIGN_ACCOUNT_ID: str = ""
    DOCUSIGN_BASE_URL: str = "https://demo.docusign.net/restapi"
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    CALENDLY_API_KEY: str = ""
    ZOOM_API_KEY: str = ""
    ZOOM_API_SECRET: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins into list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.ENVIRONMENT.lower() == "development"

    @property
    def is_sqlite(self) -> bool:
        """Check if using SQLite database."""
        return "sqlite" in self.DATABASE_URL.lower()


settings = Settings()
