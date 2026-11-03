"""Unit tests for the CLI training plan subcommands (summary, export, apply, sync)."""

from pathlib import Path

import pytest

import garmin_monitor.cli as cli_module
from garmin_monitor.cli import main
from garmin_monitor.config import Settings


def test_cli_plan_apply_summary_export_and_sync(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """CLI `plan apply`, `plan summary`, `plan export`, and `plan sync` work end-to-end."""
    db_path = tmp_path / "garmin.db"
    settings = Settings(DATABASE_PATH=db_path, GARMIN_TOKEN_DIR=tmp_path / "tokens")

    # Summary when no plan exists
    assert main(["plan", "summary"], settings=settings) == 0
    assert "No active training plan" in capsys.readouterr().out

    sample_yaml = tmp_path / "sample_plan.yaml"
    sample_yaml.write_text(
        """
name: "CLI Test Plan"
notes: "Preparing for 10K"
days:
  - date: "2026-11-02"
    sport_type: "running"
    workout_title: "Easy 8K"
    goal_km: 8.0
    hr_min: 135
    hr_max: 148
  - date: "2026-11-03"
    sport_type: "strength_training"
    workout_title: "Core & Kettlebell"
    goal_duration_min: 40.0
  - date: "2026-11-04"
    sport_type: "rest"
    workout_title: "Rest Day"
""".strip(),
        encoding="utf-8",
    )

    assert main(["plan", "apply", str(sample_yaml), "--no-garmin-sync"], settings=settings) == 0
    apply_out = capsys.readouterr().out
    assert "Applied plan 'CLI Test Plan'" in apply_out

    assert main(["plan", "summary"], settings=settings) == 0
    summary_out = capsys.readouterr().out
    assert "CLI Test Plan" in summary_out
    assert "Easy 8K" in summary_out
    assert "Core & Kettlebell" in summary_out

    export_file = tmp_path / "exported.yaml"
    assert main(["plan", "export", "--output", str(export_file)], settings=settings) == 0
    assert export_file.exists()
    assert "CLI Test Plan" in export_file.read_text(encoding="utf-8")

    # Also test stdout export
    assert main(["plan", "export"], settings=settings) == 0
    assert "Easy 8K" in capsys.readouterr().out

    # Test `plan sync`
    monkeypatch.setattr(
        cli_module,
        "sync_future_plan_to_garmin",
        lambda _settings, force=False: 2 if force else 1,
    )
    assert main(["plan", "sync", "--force"], settings=settings) == 0
    assert "Synced 2 future workouts" in capsys.readouterr().out
