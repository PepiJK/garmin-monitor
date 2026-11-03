"""Unit tests for the GarminClient wrapper, token management, and rate-limit backoff."""

from datetime import date
from pathlib import Path
from typing import Any

import pytest
from garminconnect import (
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)

from garmin_monitor.garmin_client import (
    GarminAuthError,
    GarminClient,
    GarminClientError,
    GarminRateLimitError,
)


class FakeInnerClient:
    """Fake inner curl_cffi token client."""

    def __init__(self) -> None:
        self.dumped_paths: list[str] = []

    def dump(self, path: str) -> None:
        self.dumped_paths.append(path)
        token_file = Path(path) / "garmin_tokens.json"
        token_file.write_text('{"di_token": "cached-token"}', encoding="utf-8")


class FakeGarmin:
    """Configurable fake garminconnect.Garmin instance for unit testing."""

    def __init__(
        self,
        email: str | None = None,
        password: str | None = None,
        prompt_mfa: Any = None,
    ) -> None:
        self.email = email
        self.password = password
        self.prompt_mfa = prompt_mfa
        self.client = FakeInnerClient()
        self.login_calls: list[str | None] = []
        self.login_side_effect: Exception | None = None
        self.activities_calls: int = 0
        self.activities_failures_remaining: int = 0
        self.activities_error_cls: type[Exception] = GarminConnectTooManyRequestsError
        self.deleted_workouts: list[int | str] = []
        self.unscheduled_workouts: list[int | str] = []

    def login(self, tokenstore: str | None = None) -> tuple[None, None]:
        self.login_calls.append(tokenstore)
        if self.login_side_effect is not None:
            raise self.login_side_effect
        return None, None

    def get_activities_by_date(self, start: str, end: str) -> list[dict[str, Any]]:
        self.activities_calls += 1
        if self.activities_failures_remaining > 0:
            self.activities_failures_remaining -= 1
            raise self.activities_error_cls("transient error")
        return [{"activityId": 101, "start": start, "end": end}]

    def get_user_summary(self, day: str) -> dict[str, Any]:
        return {"calendarDate": day, "totalSteps": 9500}

    def get_sleep_data(self, day: str) -> dict[str, Any]:
        return {"dailySleepDTO": {"sleepTimeSeconds": 28800}}

    def get_hrv_data(self, day: str) -> dict[str, Any]:
        return {"hrvSummary": {"lastNightAvg": 64.0, "status": "BALANCED"}}

    def get_heart_rates(self, day: str) -> dict[str, Any]:
        return {"restingHeartRate": 48}

    def get_stress_data(self, day: str) -> dict[str, Any]:
        return {"avgStressLevel": 24}

    def get_body_battery(self, start: str, end: str) -> list[dict[str, Any]]:
        return [{"charged": 88, "drained": 32}]

    def get_spo2_data(self, day: str) -> dict[str, Any]:
        return {"averageSpO2": 96.0}

    def get_respiration_data(self, day: str) -> dict[str, Any]:
        return {"avgWakingRespirationValue": 14.5}

    def get_training_readiness(self, day: str) -> list[dict[str, Any]]:
        return [{"score": 79, "level": "HIGH"}]

    def upload_workout(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {"workoutId": 555, "workoutName": payload.get("workoutName")}

    def schedule_workout(self, workout_id: int | str, date_str: str) -> dict[str, Any]:
        return {"workoutScheduleId": 777, "workoutId": workout_id, "calendarDate": date_str}

    def delete_workout(self, workout_id: int | str) -> None:
        self.deleted_workouts.append(workout_id)

    def unschedule_workout(self, schedule_id: int | str) -> None:
        self.unscheduled_workouts.append(schedule_id)


def test_interactive_login_and_headless_reload(tmp_path: Path) -> None:
    """interactive_login persists tokens and load_session reloads them without credentials."""
    token_dir = tmp_path / "garmin_tokens"
    created_instances: list[FakeGarmin] = []

    def factory(**kwargs: Any) -> FakeGarmin:
        inst = FakeGarmin(**kwargs)
        created_instances.append(inst)
        return inst

    client = GarminClient(token_dir, garmin_factory=factory)

    with pytest.raises(GarminAuthError, match="not initialized"):
        _ = client.api

    with pytest.raises(GarminAuthError, match="Both email and password"):
        client.interactive_login("", "secret")

    saved_path = client.interactive_login(
        "runner@example.com", "secret", prompt_mfa=lambda: "123456"
    )
    assert saved_path == token_dir
    assert (token_dir / "garmin_tokens.json").exists()
    assert created_instances[0].email == "runner@example.com"
    assert created_instances[0].prompt_mfa() == "123456"

    headless = GarminClient(token_dir, garmin_factory=factory)
    headless.load_session()
    assert created_instances[1].email is None
    assert created_instances[1].password is None


def test_load_session_errors(tmp_path: Path) -> None:
    """load_session raises GarminAuthError or GarminRateLimitError on invalid/missing tokens."""
    empty_dir = tmp_path / "empty_tokens"
    client = GarminClient(empty_dir, garmin_factory=FakeGarmin)
    with pytest.raises(GarminAuthError, match="missing or empty"):
        client.load_session()

    empty_dir.mkdir(parents=True)
    (empty_dir / "garmin_tokens.json").write_text("{}", encoding="utf-8")

    def failing_auth_factory(**kwargs: Any) -> FakeGarmin:
        inst = FakeGarmin(**kwargs)
        inst.login_side_effect = GarminConnectAuthenticationError("expired")
        return inst

    auth_fail_client = GarminClient(empty_dir, garmin_factory=failing_auth_factory)
    with pytest.raises(GarminAuthError, match="Failed to reload Garmin tokens"):
        auth_fail_client.load_session()

    def rate_limit_factory(**kwargs: Any) -> FakeGarmin:
        inst = FakeGarmin(**kwargs)
        inst.login_side_effect = GarminConnectTooManyRequestsError("429")
        return inst

    rl_client = GarminClient(empty_dir, garmin_factory=rate_limit_factory)
    with pytest.raises(GarminRateLimitError):
        rl_client.load_session()
    with pytest.raises(GarminRateLimitError):
        rl_client.interactive_login("a@b.com", "pw")

    auth_err_login = GarminClient(empty_dir, garmin_factory=failing_auth_factory)
    with pytest.raises(GarminAuthError, match="Interactive Garmin login failed"):
        auth_err_login.interactive_login("a@b.com", "pw")


def test_backoff_and_data_methods(tmp_path: Path) -> None:
    """GarminClient retries rate-limited calls and fetches health bundles and workouts."""
    token_dir = tmp_path / "tokens"
    token_dir.mkdir()
    (token_dir / "garmin_tokens.json").write_text("{}", encoding="utf-8")

    fake = FakeGarmin()
    fake.activities_failures_remaining = 2
    sleeps: list[float] = []

    client = GarminClient(
        token_dir,
        max_retries=3,
        base_backoff_sec=0.5,
        sleep_fn=sleeps.append,
        garmin_factory=lambda **_: fake,
    )
    client.load_session()

    activities = client.fetch_activities_by_date(date(2026, 11, 1), date(2026, 11, 2))
    assert len(activities) == 1
    assert sleeps == [0.5, 1.0]

    bundle = client.fetch_daily_health_bundle(date(2026, 11, 2))
    assert bundle["date"] == "2026-11-02"
    assert bundle["user_summary"]["totalSteps"] == 9500
    assert bundle["hrv"]["hrvSummary"]["lastNightAvg"] == 64.0

    uploaded = client.upload_workout({"workoutName": "Tempo Run"})
    assert uploaded["workoutId"] == 555
    scheduled = client.schedule_workout(555, "2026-11-04")
    assert scheduled["workoutScheduleId"] == 777
    client.delete_workout(555)
    client.unschedule_workout(777)
    assert fake.deleted_workouts == [555]
    assert fake.unscheduled_workouts == [777]


def test_backoff_exhaustion_and_connection_errors(tmp_path: Path) -> None:
    """GarminClient raises appropriate errors when retries are exhausted or auth fails mid-sync."""
    token_dir = tmp_path / "tokens"
    token_dir.mkdir()
    (token_dir / "garmin_tokens.json").write_text("{}", encoding="utf-8")

    fake = FakeGarmin()
    fake.activities_failures_remaining = 5
    client = GarminClient(
        token_dir,
        max_retries=2,
        sleep_fn=lambda _: None,
        garmin_factory=lambda **_: fake,
    )
    client.load_session()

    with pytest.raises(GarminRateLimitError, match="Rate limit exceeded"):
        client.fetch_activities_by_date(date(2026, 11, 1), date(2026, 11, 2))

    fake.activities_failures_remaining = 5
    fake.activities_error_cls = GarminConnectConnectionError
    with pytest.raises(GarminClientError, match="Connection error"):
        client.fetch_activities_by_date(date(2026, 11, 1), date(2026, 11, 2))

    fake.activities_failures_remaining = 1
    fake.activities_error_cls = GarminConnectAuthenticationError
    with pytest.raises(GarminAuthError, match="Authentication error"):
        client.fetch_activities_by_date(date(2026, 11, 1), date(2026, 11, 2))
