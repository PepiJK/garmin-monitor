"""Unit tests for the CLI auth login and sync subcommands."""

from pathlib import Path

import pytest

from garmin_monitor.cli import main
from garmin_monitor.config import Settings
from garmin_monitor.garmin_client import GarminClient
from garmin_monitor.sync_service import SyncResult, SyncService


def test_cli_auth_login(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """`python -m garmin_monitor auth login` invokes GarminClient.interactive_login."""
    token_dir = tmp_path / "garmin_tokens"
    settings = Settings(
        GARMIN_EMAIL="cli@example.com",
        GARMIN_PASSWORD="secret-password",
        GARMIN_TOKEN_DIR=token_dir,
        DATABASE_PATH=tmp_path / "garmin.db",
    )

    called_with: dict[str, str] = {}

    def fake_interactive_login(
        self: GarminClient,
        email: str,
        password: str,
        prompt_mfa: object = None,
    ) -> Path:
        called_with["email"] = email
        called_with["password"] = password
        self.token_dir.mkdir(parents=True, exist_ok=True)
        return self.token_dir

    monkeypatch.setattr(GarminClient, "interactive_login", fake_interactive_login)

    exit_code = main(["auth", "login"], settings=settings)
    assert exit_code == 0
    assert called_with == {"email": "cli@example.com", "password": "secret-password"}
    output = capsys.readouterr().out
    assert str(token_dir) in output


def test_cli_sync_with_days(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """`python -m garmin_monitor sync --days 90` triggers SyncService.sync(days=90)."""
    settings = Settings(
        GARMIN_TOKEN_DIR=tmp_path / "tokens",
        DATABASE_PATH=tmp_path / "garmin.db",
    )
    requested_days: list[int | None] = []

    def fake_sync(self: SyncService, *, days: int | None = None) -> SyncResult:
        requested_days.append(days)
        return SyncResult(
            run_id=1,
            days_synced=days or 90,
            activities_synced=18,
            health_days_synced=days or 90,
            start_date="2026-08-05",
            end_date="2026-11-02",
        )

    monkeypatch.setattr(SyncService, "sync", fake_sync)

    exit_code = main(["sync", "--days", "90"], settings=settings)
    assert exit_code == 0
    assert requested_days == [90]
    output = capsys.readouterr().out
    assert "18 activities" in output
    assert "90 health days" in output
