"""Application configuration.

Every value here comes from the environment. NFR-S5: third-party credentials are
server-side only and never reach the client. FR-A6.2: switching language provider
is a change to these values, not to application code.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- App ---
    app_env: str = "development"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:5173"

    # --- Database ---
    database_url: str

    # --- Session / auth (FR-H2.2) ---
    session_secret: str = "change-me"
    session_lifetime_days: int = 30

    # --- Development auth bypass ---
    # Lets /chat and the other authenticated routes be exercised without a
    # Firebase client. Guarded three ways: off by default, refused when
    # app_env is production (see the validator below), and logged loudly at
    # every startup so it cannot be left on unnoticed.
    dev_auth_bypass: bool = False
    dev_auth_phone: str = "+910000000001"

    # --- Firebase Phone Auth (EI-12, FR-H1.2) ---
    firebase_project_id: str = ""
    firebase_credentials_path: str = "./serviceAccountKey.json"

    # --- LLM ---
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # --- Language layer (FR-A6.2) ---
    language_provider: str = "sarvam"
    sarvam_api_key: str = ""
    sarvam_base_url: str = "https://api.sarvam.ai"
    sarvam_translate_model: str = "mayura:v1"
    sarvam_stt_model: str = "saarika:v2"
    sarvam_tts_model: str = "bulbul:v1"

    # --- PFZ microservice ---
    pfz_api_base_url: str = "http://localhost:8001"
    pfz_api_timeout_seconds: int = 30
    pfz_api_batch_size: int = 500

    # --- NASA Ocean Color (EI-1) ---
    earthdata_username: str = ""
    earthdata_password: str = ""

    # --- Keyless sources ---
    open_meteo_forecast_url: str = "https://api.open-meteo.com/v1/forecast"
    open_meteo_marine_url: str = "https://marine-api.open-meteo.com/v1/marine"
    sachet_feed_url: str = (
        "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml"
    )
    sachet_poll_interval_minutes: int = 15

    @model_validator(mode="after")
    def _refuse_bypass_in_production(self) -> "Settings":
        if self.dev_auth_bypass and self.app_env.lower() in {"production", "prod"}:
            raise ValueError(
                "DEV_AUTH_BYPASS cannot be enabled when APP_ENV is production. "
                "This would disable authentication entirely."
            )
        return self

    @property
    def sync_database_url(self) -> str:
        """psql / GeoAlchemy2 reflection form — strips the asyncpg dialect."""
        return self.database_url.replace("+asyncpg", "")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"production", "prod"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()