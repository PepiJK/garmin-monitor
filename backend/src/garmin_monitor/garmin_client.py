"""Garmin Connect client adapter supporting interactive bootstrap and headless sync."""

import logging
import time
from collections.abc import Callable
from datetime import date
from pathlib import Path
from typing import Any

from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)

logger = logging.getLogger(__name__)

type JsonDict = dict[str, Any]
type MfaPromptFn = Callable[[], str]


class GarminClientError(RuntimeError):
    """Base error for Garmin Connect client operations."""


class GarminAuthError(GarminClientError):
    """Raised when Garmin authentication or token loading fails."""


class GarminRateLimitError(GarminClientError):
    """Raised when Garmin Connect enforces HTTP 429 / 427 rate limiting."""


class GarminClient:
    """Adapter around python-garminconnect with token persistence and backoff."""

    def __init__(
        self,
        token_dir: Path,
        *,
        max_retries: int = 3,
        base_backoff_sec: float = 1.0,
        sleep_fn: Callable[[float], None] = time.sleep,
        garmin_factory: Callable[..., Garmin] = Garmin,
    ) -> None:
        self.token_dir = token_dir
        self.max_retries = max_retries
        self.base_backoff_sec = base_backoff_sec
        self._sleep_fn = sleep_fn
        self._garmin_factory = garmin_factory
        self._api: Garmin | None = None

    @property
    def api(self) -> Garmin:
        """Return the authenticated Garmin API instance or raise GarminAuthError."""
        if self._api is None:
            raise GarminAuthError(
                "Garmin session is not initialized. Call load_session() or interactive_login()."
            )
        return self._api

    def interactive_login(
        self,
        email: str,
        password: str,
        prompt_mfa: MfaPromptFn | None = None,
    ) -> Path:
        """Authenticate interactively with credentials/MFA and persist tokens to token_dir."""
        if not email or not password:
            raise GarminAuthError("Both email and password are required for interactive login.")

        self.token_dir.mkdir(parents=True, exist_ok=True)
        mfa_callback: MfaPromptFn = prompt_mfa or (lambda: input("Enter Garmin MFA code: ").strip())
        client = self._garmin_factory(
            email=email,
            password=password,
            prompt_mfa=mfa_callback,
        )
        try:
            client.login(str(self.token_dir))
            if hasattr(client, "client") and hasattr(client.client, "dump"):
                client.client.dump(str(self.token_dir))
        except GarminConnectTooManyRequestsError as exc:
            raise GarminRateLimitError(str(exc)) from exc
        except (GarminConnectAuthenticationError, GarminConnectConnectionError) as exc:
            raise GarminAuthError(f"Interactive Garmin login failed: {exc}") from exc

        self._api = client
        return self.token_dir

    def load_session(self) -> None:
        """Load cached session tokens in headless mode without using raw credentials."""
        if not self.token_dir.exists() or not any(self.token_dir.iterdir()):
            raise GarminAuthError(
                f"Garmin token directory '{self.token_dir}' is missing or empty. "
                "Run 'python -m garmin_monitor auth login' first."
            )

        client = self._garmin_factory(email=None, password=None)
        try:
            client.login(str(self.token_dir))
            if hasattr(client, "client") and hasattr(client.client, "dump"):
                client.client.dump(str(self.token_dir))
        except GarminConnectTooManyRequestsError as exc:
            raise GarminRateLimitError(str(exc)) from exc
        except (
            GarminConnectAuthenticationError,
            GarminConnectConnectionError,
            FileNotFoundError,
        ) as exc:
            raise GarminAuthError(f"Failed to reload Garmin tokens: {exc}") from exc

        self._api = client

    def _call_with_backoff[T](self, fn: Callable[[], T], operation_name: str) -> T:
        """Execute a Garmin API call with exponential backoff on rate limits / transient errors."""
        last_error: Exception | None = None
        for attempt in range(1, self.max_retries + 1):
            try:
                return fn()
            except GarminConnectTooManyRequestsError as exc:
                last_error = exc
                if attempt >= self.max_retries:
                    raise GarminRateLimitError(
                        f"Rate limit exceeded during {operation_name}: {exc}"
                    ) from exc
                wait_sec = self.base_backoff_sec * (2 ** (attempt - 1))
                logger.warning(
                    f"Rate limited during {operation_name} (attempt {attempt}/{self.max_retries}); "
                    f"backing off {wait_sec:.1f}s"
                )
                self._sleep_fn(wait_sec)
            except GarminConnectAuthenticationError as exc:
                raise GarminAuthError(
                    f"Authentication error during {operation_name}: {exc}"
                ) from exc
            except GarminConnectConnectionError as exc:
                last_error = exc
                if attempt >= self.max_retries:
                    raise GarminClientError(
                        f"Connection error during {operation_name}: {exc}"
                    ) from exc
                wait_sec = self.base_backoff_sec * (2 ** (attempt - 1))
                self._sleep_fn(wait_sec)

        raise GarminClientError(f"Operation {operation_name} failed: {last_error}")

    def fetch_activities_by_date(self, start_date: date, end_date: date) -> list[JsonDict]:
        """Fetch activities between start_date and end_date (inclusive)."""
        start_str = start_date.isoformat()
        end_str = end_date.isoformat()
        result = self._call_with_backoff(
            lambda: self.api.get_activities_by_date(start_str, end_str),
            f"get_activities_by_date({start_str}, {end_str})",
        )
        return list(result) if isinstance(result, list) else []

    def _safe_fetch_dict(self, fn: Callable[[], Any], metric_name: str) -> Any:
        """Fetch an optional daily wellness endpoint, returning None if unavailable for a day."""
        try:
            return self._call_with_backoff(fn, metric_name)
        except GarminClientError as exc:
            logger.debug(f"Metric {metric_name} unavailable: {exc}")
            return None

    def fetch_daily_health_bundle(self, target_date: date) -> JsonDict:
        """Fetch the complete daily physiological recovery bundle for target_date."""
        day_str = target_date.isoformat()
        return {
            "date": day_str,
            "user_summary": self._safe_fetch_dict(
                lambda: self.api.get_user_summary(day_str), f"user_summary({day_str})"
            ),
            "sleep": self._safe_fetch_dict(
                lambda: self.api.get_sleep_data(day_str), f"sleep({day_str})"
            ),
            "hrv": self._safe_fetch_dict(lambda: self.api.get_hrv_data(day_str), f"hrv({day_str})"),
            "heart_rates": self._safe_fetch_dict(
                lambda: self.api.get_heart_rates(day_str), f"heart_rates({day_str})"
            ),
            "stress": self._safe_fetch_dict(
                lambda: self.api.get_stress_data(day_str), f"stress({day_str})"
            ),
            "body_battery": self._safe_fetch_dict(
                lambda: self.api.get_body_battery(day_str, day_str), f"body_battery({day_str})"
            ),
            "spo2": self._safe_fetch_dict(
                lambda: self.api.get_spo2_data(day_str), f"spo2({day_str})"
            ),
            "respiration": self._safe_fetch_dict(
                lambda: self.api.get_respiration_data(day_str), f"respiration({day_str})"
            ),
            "training_readiness": self._safe_fetch_dict(
                lambda: self.api.get_training_readiness(day_str), f"training_readiness({day_str})"
            ),
        }

    def upload_workout(self, workout_payload: JsonDict) -> JsonDict:
        """Upload a structured workout template to Garmin Connect."""
        result = self._call_with_backoff(
            lambda: self.api.upload_workout(workout_payload),
            "upload_workout",
        )
        return dict(result) if isinstance(result, dict) else {}

    def schedule_workout(self, workout_id: int | str, date_str: str) -> JsonDict:
        """Schedule an uploaded workout ID onto a specific calendar date (YYYY-MM-DD)."""
        result = self._call_with_backoff(
            lambda: self.api.schedule_workout(workout_id, date_str),
            f"schedule_workout({workout_id}, {date_str})",
        )
        return dict(result) if isinstance(result, dict) else {}

    def delete_workout(self, workout_id: int | str) -> None:
        """Delete a workout template from Garmin Connect."""
        self._call_with_backoff(
            lambda: self.api.delete_workout(workout_id),
            f"delete_workout({workout_id})",
        )

    def unschedule_workout(self, schedule_id: int | str) -> None:
        """Remove a scheduled workout entry from the Garmin Connect calendar."""
        self._call_with_backoff(
            lambda: self.api.unschedule_workout(schedule_id),
            f"unschedule_workout({schedule_id})",
        )
