"""Unit tests for /api/training/dashboard, /api/training/plan, and /api/training/plan/sync."""

from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from garmin_monitor.api import training as training_api
from garmin_monitor.config import Settings
from garmin_monitor.db import connect_db, init_db
from garmin_monitor.main import create_app
from garmin_monitor.plan_schema import PlanDaySpec, TrainingPlanSpec
from garmin_monitor.plan_service import apply_plan
from garmin_monitor.sync_service import ActivityRecord, upsert_activity


def test_api_training_dashboard_and_plan(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """GET /api/training/dashboard and /api/training/plan return ISO-week and plan data."""
    db_path = tmp_path / "garmin.db"
    settings = Settings(
        DATABASE_PATH=db_path,
        GARMIN_TOKEN_DIR=tmp_path / "tokens",
        ENABLE_SCHEDULER=False,
    )
    init_db(db_path)

    # Seed activities in ISO week 2026-W45 (Monday 2026-11-02 .. Sunday 2026-11-08)
    with connect_db(db_path) as conn:
        upsert_activity(
            conn,
            ActivityRecord(
                activity_id=101,
                activity_name="Monday Morning Run",
                sport_type="running",
                start_time_local="2026-11-02T07:00:00+01:00",
                date_local="2026-11-02",
                duration_sec=2700.0,
                distance_m=9000.0,
                avg_hr=146,
                max_hr=162,
                calories=580,
                training_load=95.0,
                raw_json="{}",
                synced_at="2026-11-03T08:00:00Z",
            ),
        )
        upsert_activity(
            conn,
            ActivityRecord(
                activity_id=102,
                activity_name="Tuesday Strength Session",
                sport_type="strength_training",
                start_time_local="2026-11-03T18:00:00+01:00",
                date_local="2026-11-03",
                duration_sec=2400.0,
                distance_m=0.0,
                avg_hr=120,
                max_hr=145,
                calories=310,
                training_load=45.0,
                raw_json="{}",
                synced_at="2026-11-03T19:00:00Z",
            ),
        )

    plan = TrainingPlanSpec(
        name="Autumn Block",
        notes="Base building",
        days=[
            PlanDaySpec(
                date=date(2026, 11, 2),
                sport_type="running",
                workout_title="Monday Aerobic 9K",
                goal_km=9.0,
                hr_min=135,
                hr_max=150,
            ),
            PlanDaySpec(
                date=date(2026, 11, 3),
                sport_type="strength_training",
                workout_title="Tuesday Strength",
                goal_duration_min=45.0,
            ),
        ],
    )
    apply_plan(settings, plan, sync_to_garmin=False, reference_date=date(2026, 11, 3))

    app = create_app(settings=settings)
    with TestClient(app) as client:
        dash_resp = client.get(
            "/api/training/dashboard",
            params={"weeks": 12, "reference_date": "2026-11-03"},
        )
        assert dash_resp.status_code == 200
        dash = dash_resp.json()
        assert dash["current_week_start"] == "2026-11-02"
        assert dash["current_week_end"] == "2026-11-08"
        assert dash["ran_km_this_week"] == 9.0
        assert dash["strength_minutes_this_week"] == 40.0
        assert dash["completed_workouts_this_week"] == 2
        assert len(dash["weekly_series"]) == 12
        assert len(dash["current_week_activities"]) == 2

        plan_resp = client.get(
            "/api/training/plan",
            params={"reference_date": "2026-11-03"},
        )
        assert plan_resp.status_code == 200
        plan_json = plan_resp.json()
        assert plan_json["has_active_plan"] is True
        assert plan_json["name"] == "Autumn Block"
        assert len(plan_json["days"]) == 2
        assert plan_json["days"][0]["status"] == "done"
        assert plan_json["days"][0]["actual_km"] == 9.0
        assert plan_json["days"][1]["status"] == "done"
        assert plan_json["days"][1]["actual_duration_min"] == 40.0

        monkeypatch.setattr(
            training_api,
            "sync_future_plan_to_garmin",
            lambda _settings, force=False: 3,
        )
        sync_resp = client.post("/api/training/plan/sync")
        assert sync_resp.status_code == 200
        assert sync_resp.json() == {"uploaded_workouts": 3}
