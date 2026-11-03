"""Application configuration using Pydantic v2 Settings."""

from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

type LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables or .env file."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    garmin_email: str | None = Field(default=None, alias="GARMIN_EMAIL")
    garmin_password: str | None = Field(default=None, alias="GARMIN_PASSWORD")
    garmin_token_dir: Path = Field(
        default=Path("./data/garmin_tokens"),
        alias="GARMIN_TOKEN_DIR",
    )
    database_path: Path = Field(
        default=Path("./data/garmin.db"),
        alias="DATABASE_PATH",
    )
    tz: str = Field(default="Europe/Vienna", alias="TZ")
    sync_interval_hours: float = Field(default=2.0, alias="SYNC_INTERVAL_HOURS", gt=0)
    sync_backfill_days: int = Field(default=90, alias="SYNC_BACKFILL_DAYS", ge=1)
    log_level: LogLevel = Field(default="INFO", alias="LOG_LEVEL")
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    static_dir: Path | None = Field(default=None, alias="STATIC_DIR")
    enable_scheduler: bool = Field(default=True, alias="ENABLE_SCHEDULER")

    @property
    def timezone(self) -> ZoneInfo:
        """Return the configured IANA timezone object."""
        return ZoneInfo(self.tz)


def get_settings() -> Settings:
    """Create and return the application settings instance."""
    return Settings()
