"""Unit tests for plan_service: apply_plan, Garmin calendar sync, and auto-completion matching."""

from datetime import date
from pathlib import Path
from typing import Any

from garmin_monitor.config import Settings
from garmin_monitor.db import connect_db, init_db
from garmin_monitor.plan_schema import PlanDaySpec, TrainingPlanSpec
from garmin_monitor.plan_service import (
    apply_plan,
    export_active_plan_yaml,
    get_active_plan_with_days,
    reconcile_plan_completions,
    sync_future_plan_to_garmin,
    update_plan_day_notes,
)
from garmin_monitor.sync_service import ActivityRecord, upsert_activity


class FakePlanGarminClient:
    """Fake GarminClient tracking workout uploads, schedules, unschedules, and deletions."""

    def __init__(self) -> None:
        self.loaded = False
        self.next_workout_id = 1000
        self.next_schedule_id = 5000
        self.uploaded_payloads: list[dict[str, Any]] = []
        self.scheduled_calls: list[tuple[int | str, str]] = []
        self.deleted_workout_ids: list[int | str] = []
        self.unscheduled_ids: list[int | str] = []

    def load_session(self) -> None:
        self.loaded = True

    def upload_workout(self, workout_payload: dict[str, Any]) -> dict[str, Any]:
        self.next_workout_id += 1
        self.uploaded_payloads.append(workout_payload)
        return {"workoutId": self.next_workout_id}

    def schedule_workout(self, workout_id: int | str, date_str: str) -> dict[str, Any]:
        self.next_schedule_id += 1
        self.scheduled_calls.append((workout_id, date_str))
        return {"workoutScheduleId": self.next_schedule_id}

    def delete_workout(self, workout_id: int | str) -> None:
        self.deleted_workout_ids.append(workout_id)

    def unschedule_workout(self, schedule_id: int | str) -> None:
        self.unscheduled_ids.append(schedule_id)


def _make_activity(
    activity_id: int,
    sport_type: str,
    date_local: str,
    *,
    distance_m: float = 0.0,
    duration_sec: float = 0.0,
    avg_hr: int | None = 145,
    max_hr: int | None = 165,
    associated_workout_id: int | None = None,
) -> ActivityRecord:
    return ActivityRecord(
        activity_id=activity_id,
        activity_name=f"Activity {activity_id}",
        sport_type=sport_type,
        start_time_local=f"{date_local}T08:00:00+01:00",
        date_local=date_local,
        duration_sec=duration_sec,
        distance_m=distance_m,
        avg_hr=avg_hr,
        max_hr=max_hr,
        associated_workout_id=associated_workout_id,
        raw_json="{}",
        synced_at="2026-11-03T09:00:00Z",
    )


def test_apply_plan_and_auto_completion_rules(tmp_path: Path) -> None:
    """apply_plan uploads future workouts, matches activities, and preserves completed history."""
    db_path = tmp_path / "garmin.db"
    settings = Settings(DATABASE_PATH=db_path, GARMIN_TOKEN_DIR=tmp_path / "tokens")
    init_db(db_path)

    # Seed activities in SQLite:
    # - 2026-11-01: running 8.5 km on 10 km goal (85% -> done)
    # - 2026-11-02: running 5.0 km on 10 km goal (50% -> partial)
    # - 2026-11-03: missed past workout (no activity -> missed)
    # - 2026-11-04 (today): strength matched by associated_workout_id (40/45 min -> done)
    with connect_db(db_path) as conn:
        upsert_activity(
            conn,
            _make_activity(
                1,
                "running",
                "2026-11-01",
                distance_m=8500.0,
                duration_sec=2550.0,
                avg_hr=148,
                max_hr=166,
            ),
        )
        upsert_activity(
            conn,
            _make_activity(
                2,
                "running",
                "2026-11-02",
                distance_m=5000.0,
                duration_sec=1500.0,
                avg_hr=142,
                max_hr=158,
            ),
        )

    fake_client = FakePlanGarminClient()
    plan_v1 = TrainingPlanSpec(
        name="Week 1 Plan",
        days=[
            PlanDaySpec(
                date=date(2026, 11, 1),
                sport_type="running",
                workout_title="Sunday Long Run",
                goal_km=10.0,
            ),
            PlanDaySpec(
                date=date(2026, 11, 2),
                sport_type="running",
                workout_title="Monday Recovery Run",
                goal_km=10.0,
            ),
            PlanDaySpec(
                date=date(2026, 11, 3),
                sport_type="running",
                workout_title="Tuesday Tempo",
                goal_km=8.0,
            ),
            PlanDaySpec(
                date=date(2026, 11, 4),
                sport_type="strength_training",
                workout_title="Wednesday Strength",
                goal_duration_min=45.0,
            ),
            PlanDaySpec(
                date=date(2026, 11, 5),
                sport_type="rest",
                workout_title="Thursday Rest",
            ),
            PlanDaySpec(
                date=date(2026, 11, 6),
                sport_type="running",
                workout_title="Friday Intervals",
                goal_km=9.0,
            ),
        ],
    )

    today = date(2026, 11, 4)
    res1 = apply_plan(
        settings,
        plan_v1,
        client=fake_client,  # type: ignore[arg-type]
        reference_date=today,
    )
    # Only future/today non-rest workouts (Nov 4 strength and Nov 6 running) are uploaded
    assert res1.uploaded_workouts == 2
    assert len(fake_client.scheduled_calls) == 2

    # Now sync an activity matching Nov 4's uploaded garmin_workout_id (1001)
    with connect_db(db_path) as conn:
        upsert_activity(
            conn,
            _make_activity(
                3,
                "strength_training",
                "2026-11-04",
                duration_sec=2400.0,
                avg_hr=122,
                max_hr=146,
                associated_workout_id=1001,
            ),
        )
        reconcile_plan_completions(conn, today)
        _, days = get_active_plan_with_days(conn)
        by_date = {d["date"]: d for d in days}

        assert by_date["2026-11-01"]["status"] == "done"
        assert by_date["2026-11-01"]["actual_km"] == 8.5
        assert by_date["2026-11-02"]["status"] == "partial"
        assert by_date["2026-11-02"]["actual_km"] == 5.0
        assert by_date["2026-11-03"]["status"] == "missed"
        assert by_date["2026-11-04"]["status"] == "done"
        assert by_date["2026-11-04"]["actual_duration_min"] == 40.0
        assert by_date["2026-11-05"]["status"] == "rest"
        assert by_date["2026-11-06"]["status"] == "pending"

    # Re-apply an updated plan:
    # - Past completed rows (2026-11-01 'done', 2026-11-02 'partial') are preserved
    # - Superseded future workouts (Nov 4, Nov 6) are unscheduled & deleted before re-upload
    plan_v2 = TrainingPlanSpec(
        name="Week 1 Plan Adapted",
        days=[
            PlanDaySpec(
                date=date(2026, 11, 1),
                sport_type="running",
                workout_title="Mutated Title Should Not Overwrite Completed",
                goal_km=25.0,
            ),
            PlanDaySpec(
                date=date(2026, 11, 2),
                sport_type="running",
                workout_title="Monday Recovery Run",
                goal_km=10.0,
            ),
            PlanDaySpec(
                date=date(2026, 11, 4),
                sport_type="strength_training",
                workout_title="Wednesday Strength",
                goal_duration_min=45.0,
            ),
            PlanDaySpec(
                date=date(2026, 11, 6),
                sport_type="running",
                workout_title="Friday Easy 6K",
                goal_km=6.0,
            ),
        ],
    )
    res2 = apply_plan(
        settings,
        plan_v2,
        client=fake_client,  # type: ignore[arg-type]
        reference_date=today,
    )
    assert res2.preserved_past_days == 2
    assert res2.deleted_workouts == 2
    assert len(fake_client.deleted_workout_ids) == 2
    assert len(fake_client.unscheduled_ids) == 2

    with connect_db(db_path) as conn:
        _, days_v2 = get_active_plan_with_days(conn)
        by_date_v2 = {d["date"]: d for d in days_v2}
        # Completed Nov 1 preserved its original title ("Sunday Long Run") and goal (10.0 km)
        assert by_date_v2["2026-11-01"]["workout_title"] == "Sunday Long Run"
        assert by_date_v2["2026-11-01"]["goal_km"] == 10.0
        assert by_date_v2["2026-11-01"]["status"] == "done"
        assert by_date_v2["2026-11-06"]["workout_title"] == "Friday Easy 6K"
        assert by_date_v2["2026-11-06"]["goal_km"] == 6.0

    exported_yaml = export_active_plan_yaml(settings)
    assert "Week 1 Plan Adapted" in exported_yaml
    assert "Friday Easy 6K" in exported_yaml

    # Test sync_future_plan_to_garmin with force=True
    re_uploaded = sync_future_plan_to_garmin(
        settings,
        client=fake_client,  # type: ignore[arg-type]
        force=True,
        reference_date=today,
    )
    assert re_uploaded == 2

    # Test update_plan_day_notes persists and exports cleanly
    updated_row = update_plan_day_notes(settings, "2026-11-06", "Gutes Gefühl im Aufbau")
    assert updated_row is not None
    assert updated_row["notes"] == "Gutes Gefühl im Aufbau"
    assert "Gutes Gefühl im Aufbau" in export_active_plan_yaml(settings)
