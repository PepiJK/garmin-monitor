"""Training plan persistence, Fenix 7S calendar synchronization, and completion matcher."""

import json
import logging
import sqlite3
from datetime import UTC, date, datetime
from typing import Any

from pydantic import BaseModel

from garmin_monitor.config import Settings
from garmin_monitor.db import RowDict, connect_db, init_db
from garmin_monitor.garmin_client import GarminClient, GarminClientError
from garmin_monitor.plan_schema import (
    PlanDaySpec,
    PlanDayStatus,
    SportType,
    TrainingPlanSpec,
    WorkoutStepSpec,
    dump_plan_to_yaml,
)
from garmin_monitor.workout_builder import build_garmin_workout_payload

logger = logging.getLogger(__name__)

COMPLETION_RATIO_THRESHOLD: float = 0.80


class PlanApplyResult(BaseModel):
    """Summary of applying a training plan and reconciling Garmin Connect workouts."""

    plan_id: int
    plan_name: str
    total_days: int
    preserved_past_days: int
    deleted_workouts: int
    uploaded_workouts: int
    reconciled_days: int


def _cleanup_garmin_workout(
    client: GarminClient,
    workout_id: int | None,
    schedule_id: int | None,
) -> bool:
    """Unschedule and delete a superseded Garmin Connect workout."""
    cleaned = False
    if schedule_id is not None:
        try:
            client.unschedule_workout(schedule_id)
            cleaned = True
        except GarminClientError as exc:
            logger.warning(f"Failed to unschedule workout {schedule_id}: {exc}")
    if workout_id is not None:
        try:
            client.delete_workout(workout_id)
            cleaned = True
        except GarminClientError as exc:
            logger.warning(f"Failed to delete workout {workout_id}: {exc}")
    return cleaned


def _upload_and_schedule_day(
    client: GarminClient,
    day: PlanDaySpec,
) -> tuple[int | None, int | None]:
    """Upload a workout payload for day and schedule it on day.date on the Fenix 7S calendar."""
    payload = build_garmin_workout_payload(day)
    if payload is None:
        return None, None

    uploaded = client.upload_workout(payload)
    raw_workout_id = uploaded.get("workoutId")
    workout_id = int(raw_workout_id) if raw_workout_id is not None else None
    schedule_id: int | None = None
    if workout_id is not None:
        scheduled = client.schedule_workout(workout_id, day.date.isoformat())
        raw_sched_id = scheduled.get("workoutScheduleId") or scheduled.get("calendarId")
        if raw_sched_id is not None:
            schedule_id = int(raw_sched_id)
    return workout_id, schedule_id


def evaluate_day_status(
    *,
    sport_type: SportType,
    has_match: bool,
    goal_km: float | None,
    goal_duration_min: float | None,
    actual_km: float | None,
    actual_duration_min: float | None,
    is_past: bool,
) -> PlanDayStatus:
    """Compute a plan day's completion status using Python 3.14 structural pattern matching."""
    ratio_met = False
    if has_match:
        match sport_type:
            case "running":
                if goal_km is not None and goal_km > 0:
                    ratio_met = (actual_km or 0.0) >= (goal_km * COMPLETION_RATIO_THRESHOLD)
                elif goal_duration_min is not None and goal_duration_min > 0:
                    ratio_met = (actual_duration_min or 0.0) >= (
                        goal_duration_min * COMPLETION_RATIO_THRESHOLD
                    )
                else:
                    ratio_met = True
            case "strength_training":
                if goal_duration_min is not None and goal_duration_min > 0:
                    ratio_met = (actual_duration_min or 0.0) >= (
                        goal_duration_min * COMPLETION_RATIO_THRESHOLD
                    )
                else:
                    ratio_met = True
            case "rest":
                ratio_met = True

    match (sport_type, has_match, ratio_met, is_past):
        case ("rest", _, _, _):
            return "rest"
        case (_, True, True, _):
            return "done"
        case (_, True, False, _):
            return "partial"
        case (_, False, _, True):
            return "missed"
        case (_, False, _, False):
            return "pending"


def _aggregate_activities(rows: list[sqlite3.Row]) -> dict[str, Any]:
    """Aggregate distance, duration, duration-weighted avg HR, and max HR across activities."""
    total_distance_m = sum(float(r["distance_m"] or 0.0) for r in rows)
    total_duration_sec = sum(float(r["duration_sec"] or 0.0) for r in rows)

    weighted_hr_sum = 0.0
    hr_duration_sum = 0.0
    max_hrs: list[int] = []
    for r in rows:
        dur = float(r["duration_sec"] or 0.0)
        if r["avg_hr"] is not None and dur > 0:
            weighted_hr_sum += float(r["avg_hr"]) * dur
            hr_duration_sum += dur
        elif r["avg_hr"] is not None and hr_duration_sum == 0:
            weighted_hr_sum += float(r["avg_hr"])
            hr_duration_sum += 1.0
        if r["max_hr"] is not None:
            max_hrs.append(int(r["max_hr"]))

    avg_hr = round(weighted_hr_sum / hr_duration_sum) if hr_duration_sum > 0 else None
    max_hr = max(max_hrs) if max_hrs else None
    return {
        "actual_km": round(total_distance_m / 1000.0, 2),
        "actual_duration_min": round(total_duration_sec / 60.0, 1),
        "actual_avg_hr": avg_hr,
        "actual_max_hr": max_hr,
        "activity_ids": [int(r["activity_id"]) for r in rows],
    }


def reconcile_plan_completions(conn: sqlite3.Connection, today_local: date) -> int:
    """Match synced activities against plan_days and update actual metrics and statuses."""
    plan_row = conn.execute(
        "SELECT id FROM training_plans WHERE is_active = 1 ORDER BY id DESC LIMIT 1"
    ).fetchone()
    if plan_row is None:
        return 0

    plan_id = int(plan_row["id"])
    day_rows = conn.execute(
        "SELECT * FROM plan_days WHERE plan_id = ? ORDER BY date ASC",
        (plan_id,),
    ).fetchall()

    updated_count = 0
    now_iso = datetime.now(UTC).isoformat()

    for day_row in day_rows:
        day_date = date.fromisoformat(str(day_row["date"]))
        sport_type: SportType = day_row["sport_type"]
        is_past = day_date < today_local

        if sport_type == "rest":
            if day_row["status"] != "rest":
                conn.execute(
                    "UPDATE plan_days SET status = 'rest', updated_at = ? WHERE id = ?",
                    (now_iso, day_row["id"]),
                )
                updated_count += 1
            continue

        matched_rows: list[sqlite3.Row] = []
        garmin_workout_id = day_row["garmin_workout_id"]
        if garmin_workout_id is not None:
            matched_rows = conn.execute(
                """
                SELECT * FROM activities
                WHERE associated_workout_id = ?
                ORDER BY start_time_local ASC
                """,
                (garmin_workout_id,),
            ).fetchall()

        if not matched_rows:
            matched_rows = conn.execute(
                """
                SELECT * FROM activities
                WHERE date_local = ? AND sport_type = ?
                ORDER BY start_time_local ASC
                """,
                (day_date.isoformat(), sport_type),
            ).fetchall()

        if matched_rows:
            agg = _aggregate_activities(matched_rows)
            new_status = evaluate_day_status(
                sport_type=sport_type,
                has_match=True,
                goal_km=day_row["goal_km"],
                goal_duration_min=day_row["goal_duration_min"],
                actual_km=agg["actual_km"],
                actual_duration_min=agg["actual_duration_min"],
                is_past=is_past,
            )
            conn.execute(
                """
                UPDATE plan_days
                SET actual_km = ?,
                    actual_duration_min = ?,
                    actual_avg_hr = ?,
                    actual_max_hr = ?,
                    matched_activity_ids = ?,
                    status = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    agg["actual_km"],
                    agg["actual_duration_min"],
                    agg["actual_avg_hr"],
                    agg["actual_max_hr"],
                    json.dumps(agg["activity_ids"]),
                    new_status,
                    now_iso,
                    day_row["id"],
                ),
            )
            updated_count += 1
        else:
            # Preserve historical completed rows that were manually/previously marked done/partial
            if (
                is_past
                and day_row["status"] in ("done", "partial")
                and (day_row["actual_km"] is not None or day_row["actual_duration_min"] is not None)
            ):
                continue

            new_status = evaluate_day_status(
                sport_type=sport_type,
                has_match=False,
                goal_km=day_row["goal_km"],
                goal_duration_min=day_row["goal_duration_min"],
                actual_km=None,
                actual_duration_min=None,
                is_past=is_past,
            )
            conn.execute(
                """
                UPDATE plan_days
                SET actual_km = NULL,
                    actual_duration_min = NULL,
                    actual_avg_hr = NULL,
                    actual_max_hr = NULL,
                    matched_activity_ids = '[]',
                    status = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (new_status, now_iso, day_row["id"]),
            )
            updated_count += 1

    return updated_count


def apply_plan(
    settings: Settings,
    plan_spec: TrainingPlanSpec,
    raw_yaml: str | None = None,
    *,
    client: GarminClient | None = None,
    sync_to_garmin: bool = True,
    reference_date: date | None = None,
) -> PlanApplyResult:
    """Validate and persist an active training plan, reconciling future Fenix 7S workouts."""
    init_db(settings.database_path)
    today_local = reference_date or datetime.now(settings.timezone).date()
    yaml_text = raw_yaml if raw_yaml is not None else dump_plan_to_yaml(plan_spec)
    now_iso = datetime.now(UTC).isoformat()

    garmin_client = client or GarminClient(settings.garmin_token_dir)
    if sync_to_garmin:
        garmin_client.load_session()

    deleted_workouts = 0
    uploaded_workouts = 0
    preserved_past_days = 0

    with connect_db(settings.database_path) as conn:
        existing_rows = {
            str(r["date"]): dict(r) for r in conn.execute("SELECT * FROM plan_days").fetchall()
        }
        incoming_dates = {d.date.isoformat() for d in plan_spec.days}

        # Clean up future Garmin workouts on dates that are removed or replaced
        for date_str, old_row in existing_rows.items():
            old_date = date.fromisoformat(date_str)
            if old_date >= today_local and (
                old_row.get("garmin_workout_id") is not None
                or old_row.get("garmin_schedule_id") is not None
            ):
                if sync_to_garmin and _cleanup_garmin_workout(
                    garmin_client,
                    old_row.get("garmin_workout_id"),
                    old_row.get("garmin_schedule_id"),
                ):
                    deleted_workouts += 1

            # Delete removed future dates or uncompleted past dates not in new plan
            if date_str not in incoming_dates:
                if old_date < today_local and old_row.get("status") in ("done", "partial"):
                    continue
                conn.execute("DELETE FROM plan_days WHERE date = ?", (date_str,))

        conn.execute("UPDATE training_plans SET is_active = 0 WHERE is_active = 1")
        cursor = conn.execute(
            """
            INSERT INTO training_plans (
                name, start_date, end_date, notes, raw_yaml, is_active, updated_at
            )
            VALUES (?, ?, ?, ?, ?, 1, ?)
            """,
            (
                plan_spec.name,
                plan_spec.start_date.isoformat(),
                plan_spec.end_date.isoformat(),
                plan_spec.notes,
                yaml_text,
                now_iso,
            ),
        )
        plan_id = int(cursor.lastrowid or 0)

        # Attach any preserved historical completed rows outside incoming_dates to this active plan
        conn.execute("UPDATE plan_days SET plan_id = ? WHERE plan_id != ?", (plan_id, plan_id))

        for day in plan_spec.days:
            date_str = day.date.isoformat()
            old_row = existing_rows.get(date_str)

            # Preserve completed historical rows (date < today with done / partial)
            if (
                old_row is not None
                and day.date < today_local
                and old_row.get("status") in ("done", "partial")
            ):
                conn.execute(
                    "UPDATE plan_days SET plan_id = ?, updated_at = ? WHERE date = ?",
                    (plan_id, now_iso, date_str),
                )
                preserved_past_days += 1
                continue

            workout_id: int | None = None
            schedule_id: int | None = None
            if sync_to_garmin and day.date >= today_local and day.sport_type != "rest":
                workout_id, schedule_id = _upload_and_schedule_day(garmin_client, day)
                if workout_id is not None:
                    uploaded_workouts += 1

            steps_serialized = json.dumps(
                [s.model_dump(mode="json", exclude_none=True) for s in day.steps]
            )
            initial_status: PlanDayStatus = (
                "rest"
                if day.sport_type == "rest"
                else ("missed" if day.date < today_local else "pending")
            )

            conn.execute(
                """
                INSERT INTO plan_days (
                    plan_id, date, sport_type, workout_title, focus,
                    goal_km, goal_duration_min, hr_goal_label, hr_min, hr_max,
                    steps_json, garmin_workout_id, garmin_schedule_id,
                    status, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(date) DO UPDATE SET
                    plan_id = excluded.plan_id,
                    sport_type = excluded.sport_type,
                    workout_title = excluded.workout_title,
                    focus = excluded.focus,
                    goal_km = excluded.goal_km,
                    goal_duration_min = excluded.goal_duration_min,
                    hr_goal_label = excluded.hr_goal_label,
                    hr_min = excluded.hr_min,
                    hr_max = excluded.hr_max,
                    steps_json = excluded.steps_json,
                    garmin_workout_id = excluded.garmin_workout_id,
                    garmin_schedule_id = excluded.garmin_schedule_id,
                    status = excluded.status,
                    updated_at = excluded.updated_at
                """,
                (
                    plan_id,
                    date_str,
                    day.sport_type,
                    day.workout_title,
                    day.focus,
                    day.goal_km,
                    day.goal_duration_min,
                    day.hr_goal_label,
                    day.hr_min,
                    day.hr_max,
                    steps_serialized,
                    workout_id,
                    schedule_id,
                    initial_status,
                    now_iso,
                ),
            )

        reconciled_days = reconcile_plan_completions(conn, today_local)

    return PlanApplyResult(
        plan_id=plan_id,
        plan_name=plan_spec.name,
        total_days=len(plan_spec.days),
        preserved_past_days=preserved_past_days,
        deleted_workouts=deleted_workouts,
        uploaded_workouts=uploaded_workouts,
        reconciled_days=reconciled_days,
    )


def sync_future_plan_to_garmin(
    settings: Settings,
    *,
    client: GarminClient | None = None,
    force: bool = False,
    reference_date: date | None = None,
) -> int:
    """Upload and calendar-schedule pending future plan days to Garmin Connect."""
    init_db(settings.database_path)
    today_local = reference_date or datetime.now(settings.timezone).date()
    garmin_client = client or GarminClient(settings.garmin_token_dir)
    garmin_client.load_session()

    uploaded_count = 0
    now_iso = datetime.now(UTC).isoformat()

    with connect_db(settings.database_path) as conn:
        plan_row = conn.execute(
            "SELECT id FROM training_plans WHERE is_active = 1 ORDER BY id DESC LIMIT 1"
        ).fetchone()
        if plan_row is None:
            return 0

        rows = conn.execute(
            """
            SELECT * FROM plan_days
            WHERE plan_id = ? AND date >= ? AND sport_type != 'rest'
            ORDER BY date ASC
            """,
            (plan_row["id"], today_local.isoformat()),
        ).fetchall()

        for row in rows:
            if not force and row["garmin_workout_id"] is not None:
                continue
            if force and (
                row["garmin_workout_id"] is not None or row["garmin_schedule_id"] is not None
            ):
                _cleanup_garmin_workout(
                    garmin_client,
                    row["garmin_workout_id"],
                    row["garmin_schedule_id"],
                )

            raw_steps = json.loads(row["steps_json"] or "[]")
            spec_day = PlanDaySpec(
                date=date.fromisoformat(row["date"]),
                sport_type=row["sport_type"],
                workout_title=row["workout_title"],
                focus=row["focus"],
                goal_km=row["goal_km"],
                goal_duration_min=row["goal_duration_min"],
                hr_goal_label=row["hr_goal_label"],
                hr_min=row["hr_min"],
                hr_max=row["hr_max"],
                steps=[WorkoutStepSpec.model_validate(s) for s in raw_steps],
            )
            workout_id, schedule_id = _upload_and_schedule_day(garmin_client, spec_day)
            if workout_id is not None:
                conn.execute(
                    """
                    UPDATE plan_days
                    SET garmin_workout_id = ?, garmin_schedule_id = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (workout_id, schedule_id, now_iso, row["id"]),
                )
                uploaded_count += 1

    return uploaded_count


def get_active_plan_with_days(conn: sqlite3.Connection) -> tuple[RowDict | None, list[RowDict]]:
    """Fetch the active training_plans row and all ordered plan_days rows."""
    plan_row = conn.execute(
        "SELECT * FROM training_plans WHERE is_active = 1 ORDER BY id DESC LIMIT 1"
    ).fetchone()
    if plan_row is None:
        return None, []
    days = conn.execute(
        "SELECT * FROM plan_days WHERE plan_id = ? ORDER BY date ASC",
        (plan_row["id"],),
    ).fetchall()
    return dict(plan_row), [dict(d) for d in days]


def export_active_plan_yaml(settings: Settings) -> str:
    """Export the active training plan from SQLite into canonical YAML format."""
    init_db(settings.database_path)
    with connect_db(settings.database_path) as conn:
        plan_row, day_rows = get_active_plan_with_days(conn)
        if plan_row is None or not day_rows:
            raise ValueError("No active training plan found in SQLite")

        days_spec: list[PlanDaySpec] = []
        for r in day_rows:
            raw_steps = json.loads(r["steps_json"] or "[]")
            days_spec.append(
                PlanDaySpec(
                    date=date.fromisoformat(r["date"]),
                    sport_type=r["sport_type"],
                    workout_title=r["workout_title"],
                    focus=r["focus"],
                    goal_km=r["goal_km"],
                    goal_duration_min=r["goal_duration_min"],
                    hr_goal_label=r["hr_goal_label"],
                    hr_min=r["hr_min"],
                    hr_max=r["hr_max"],
                    steps=[WorkoutStepSpec.model_validate(s) for s in raw_steps],
                    status=r["status"],
                )
            )
        spec = TrainingPlanSpec(
            name=str(plan_row["name"]),
            notes=plan_row["notes"],
            days=days_spec,
        )
        return dump_plan_to_yaml(spec)
