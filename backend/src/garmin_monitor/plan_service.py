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
    StammdatenEntrySpec,
    TrainingPlanSpec,
    WorkoutStepSpec,
    dump_plan_to_yaml,
    dump_stammdaten_to_yaml,
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
    stammdaten_rows: int = 0


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


def _normalize_garmin_rpe(raw_val: Any) -> int | None:
    """Normalize Garmin directWorkoutRpe (10..100 or 1..10) into 1..10 RPE scale."""
    if raw_val is None or isinstance(raw_val, bool):
        return None
    try:
        val = float(raw_val)
    except TypeError, ValueError:
        return None
    if 1.0 <= val <= 10.0:
        return round(val)
    if 10.0 < val <= 100.0:
        return max(1, min(10, round(val / 10.0)))
    return None


def _aggregate_activities(rows: list[sqlite3.Row]) -> dict[str, Any]:
    """Aggregate distance, duration, pace, HR, cadence, power, load, TE, calories, and RPE."""
    total_distance_m = sum(float(r["distance_m"] or 0.0) for r in rows)
    total_duration_sec = sum(float(r["duration_sec"] or 0.0) for r in rows)

    weighted_hr_sum = 0.0
    hr_duration_sum = 0.0
    max_hrs: list[int] = []
    weighted_cadence_sum = 0.0
    cadence_dur_sum = 0.0
    stride_vals: list[float] = []
    weighted_power_sum = 0.0
    power_dur_sum = 0.0
    loads: list[float] = []
    aer_tes: list[float] = []
    ana_tes: list[float] = []
    cals: list[int] = []
    rpes: list[int] = []

    for r in rows:
        dur = float(r["duration_sec"] or 0.0)
        weight = dur if dur > 0 else 1.0
        row_keys = set(r.keys())

        if r["avg_hr"] is not None:
            weighted_hr_sum += float(r["avg_hr"]) * weight
            hr_duration_sum += weight
        if r["max_hr"] is not None:
            max_hrs.append(int(r["max_hr"]))

        raw: dict[str, Any] = {}
        if "raw_json" in row_keys and isinstance(r["raw_json"], str) and r["raw_json"].strip():
            try:
                parsed = json.loads(r["raw_json"])
                if isinstance(parsed, dict):
                    raw = parsed
            except ValueError:
                pass

        cad = raw.get("averageRunningCadenceInStepsPerMinute") or raw.get("averageRunCadence")
        if cad is not None:
            try:
                cad_f = float(cad)
                if cad_f > 0:
                    weighted_cadence_sum += cad_f * weight
                    cadence_dur_sum += weight
            except TypeError, ValueError:
                pass

        stride_cm = raw.get("avgStrideLength") or raw.get("strideLength")
        if stride_cm is not None:
            try:
                stride_f = float(stride_cm)
                if stride_f > 0:
                    stride_vals.append(stride_f / 100.0)
            except TypeError, ValueError:
                pass

        pwr = raw.get("avgPower") or raw.get("averagePower")
        if pwr is not None:
            try:
                pwr_f = float(pwr)
                if pwr_f > 0:
                    weighted_power_sum += pwr_f * weight
                    power_dur_sum += weight
            except TypeError, ValueError:
                pass

        t_load = (
            r["training_load"]
            if ("training_load" in row_keys and r["training_load"] is not None)
            else raw.get("activityTrainingLoad")
        )
        if t_load is not None:
            try:
                loads.append(float(t_load))
            except TypeError, ValueError:
                pass

        aer = (
            r["aerobic_te"]
            if ("aerobic_te" in row_keys and r["aerobic_te"] is not None)
            else raw.get("aerobicTrainingEffect")
        )
        if aer is not None:
            try:
                aer_tes.append(float(aer))
            except TypeError, ValueError:
                pass

        ana = (
            r["anaerobic_te"]
            if ("anaerobic_te" in row_keys and r["anaerobic_te"] is not None)
            else raw.get("anaerobicTrainingEffect")
        )
        if ana is not None:
            try:
                ana_tes.append(float(ana))
            except TypeError, ValueError:
                pass

        cal = (
            r["calories"]
            if ("calories" in row_keys and r["calories"] is not None)
            else raw.get("calories")
        )
        if cal is not None:
            try:
                cals.append(round(float(cal)))
            except TypeError, ValueError:
                pass

        rpe_val = _normalize_garmin_rpe(
            raw.get("directWorkoutRpe")
            if raw.get("directWorkoutRpe") is not None
            else raw.get("workoutRpe")
        )
        if rpe_val is not None:
            rpes.append(rpe_val)

    avg_hr = round(weighted_hr_sum / hr_duration_sum) if hr_duration_sum > 0 else None
    max_hr = max(max_hrs) if max_hrs else None
    actual_pace: str | None = None
    if total_distance_m > 0 and total_duration_sec > 0:
        pace_sec = round(total_duration_sec / (total_distance_m / 1000.0))
        if 60 <= pace_sec <= 3600:
            actual_pace = f"{pace_sec // 60:02d}:{pace_sec % 60:02d}"

    avg_cadence = round(weighted_cadence_sum / cadence_dur_sum) if cadence_dur_sum > 0 else None
    avg_stride = round(sum(stride_vals) / len(stride_vals), 2) if stride_vals else None
    avg_power = round(weighted_power_sum / power_dur_sum) if power_dur_sum > 0 else None
    total_load = round(sum(loads), 1) if loads else None
    max_aer_te = round(max(aer_tes), 1) if aer_tes else None
    max_ana_te = round(max(ana_tes), 1) if ana_tes else None
    total_calories = sum(cals) if cals else None
    matched_rpe = max(rpes) if rpes else None

    return {
        "actual_km": round(total_distance_m / 1000.0, 2),
        "actual_duration_min": round(total_duration_sec / 60.0, 1),
        "actual_avg_hr": avg_hr,
        "actual_max_hr": max_hr,
        "actual_pace_min_per_km": actual_pace,
        "actual_cadence_spm": avg_cadence,
        "actual_stride_m": avg_stride,
        "actual_power_w": avg_power,
        "actual_training_load": total_load,
        "actual_aerobic_te": max_aer_te,
        "actual_anaerobic_te": max_ana_te,
        "actual_calories": total_calories,
        "rpe": matched_rpe,
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
                    actual_pace_min_per_km = ?,
                    actual_cadence_spm = ?,
                    actual_stride_m = ?,
                    actual_power_w = ?,
                    actual_training_load = ?,
                    actual_aerobic_te = ?,
                    actual_anaerobic_te = ?,
                    actual_calories = ?,
                    rpe = COALESCE(?, rpe),
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
                    agg["actual_pace_min_per_km"],
                    agg["actual_cadence_spm"],
                    agg["actual_stride_m"],
                    agg["actual_power_w"],
                    agg["actual_training_load"],
                    agg["actual_aerobic_te"],
                    agg["actual_anaerobic_te"],
                    agg["actual_calories"],
                    agg["rpe"],
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
                    actual_pace_min_per_km = NULL,
                    actual_cadence_spm = NULL,
                    actual_stride_m = NULL,
                    actual_power_w = NULL,
                    actual_training_load = NULL,
                    actual_aerobic_te = NULL,
                    actual_anaerobic_te = NULL,
                    actual_calories = NULL,
                    matched_activity_ids = '[]',
                    status = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (new_status, now_iso, day_row["id"]),
            )
            updated_count += 1

    return updated_count


def apply_stammdaten_conn(
    conn: sqlite3.Connection,
    entries: list[StammdatenEntrySpec],
) -> int:
    """Replace all stammdaten rows in SQLite with the given ordered entries."""
    now_iso = datetime.now(UTC).isoformat()
    conn.execute("DELETE FROM stammdaten")
    for idx, entry in enumerate(entries):
        conn.execute(
            """
            INSERT INTO stammdaten (
                sort_order, category, parameter, value, unit_or_range, reference_note, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                idx,
                entry.category,
                entry.parameter,
                entry.value,
                entry.unit_or_range,
                entry.reference_note,
                now_iso,
            ),
        )
    return len(entries)


def apply_stammdaten(settings: Settings, entries: list[StammdatenEntrySpec]) -> int:
    """Initialize SQLite and replace all stammdaten rows."""
    init_db(settings.database_path)
    with connect_db(settings.database_path) as conn:
        return apply_stammdaten_conn(conn, entries)


def get_stammdaten(conn: sqlite3.Connection) -> list[RowDict]:
    """Fetch all ordered stammdaten rows from SQLite."""
    rows = conn.execute("SELECT * FROM stammdaten ORDER BY sort_order ASC, id ASC").fetchall()
    return [dict(r) for r in rows]


def export_stammdaten_yaml(settings: Settings) -> str:
    """Export stammdaten rows from SQLite into canonical YAML format."""
    init_db(settings.database_path)
    with connect_db(settings.database_path) as conn:
        rows = get_stammdaten(conn)
    entries = [
        StammdatenEntrySpec(
            category=str(r["category"]),
            parameter=str(r["parameter"]),
            value=str(r["value"]),
            unit_or_range=r.get("unit_or_range"),
            reference_note=r.get("reference_note"),
        )
        for r in rows
    ]
    return dump_stammdaten_to_yaml(entries)


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
    stammdaten_rows = 0

    with connect_db(settings.database_path) as conn:
        if plan_spec.stammdaten is not None:
            stammdaten_rows = apply_stammdaten_conn(conn, plan_spec.stammdaten)

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
                    """
                    UPDATE plan_days
                    SET plan_id = ?,
                        rpe = COALESCE(?, rpe),
                        notes = COALESCE(?, notes),
                        updated_at = ?
                    WHERE date = ?
                    """,
                    (plan_id, day.rpe, day.notes, now_iso, date_str),
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
                else (
                    day.status
                    if day.status in ("done", "partial", "missed") and day.date < today_local
                    else ("missed" if day.date < today_local else "pending")
                )
            )

            conn.execute(
                """
                INSERT INTO plan_days (
                    plan_id, date, sport_type, workout_title, focus,
                    goal_km, goal_duration_min, hr_goal_label, hr_min, hr_max,
                    steps_json, garmin_workout_id, garmin_schedule_id,
                    actual_km, actual_duration_min, actual_avg_hr, actual_max_hr,
                    actual_pace_min_per_km, rpe, notes,
                    status, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    actual_km = COALESCE(excluded.actual_km, plan_days.actual_km),
                    actual_duration_min = COALESCE(
                        excluded.actual_duration_min, plan_days.actual_duration_min
                    ),
                    actual_avg_hr = COALESCE(excluded.actual_avg_hr, plan_days.actual_avg_hr),
                    actual_max_hr = COALESCE(excluded.actual_max_hr, plan_days.actual_max_hr),
                    actual_pace_min_per_km = COALESCE(
                        excluded.actual_pace_min_per_km, plan_days.actual_pace_min_per_km
                    ),
                    rpe = COALESCE(excluded.rpe, plan_days.rpe),
                    notes = COALESCE(excluded.notes, plan_days.notes),
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
                    day.actual_km,
                    day.actual_duration_min,
                    day.actual_avg_hr,
                    day.actual_max_hr,
                    day.actual_pace_min_per_km,
                    day.rpe,
                    day.notes,
                    initial_status,
                    now_iso,
                ),
            )

        reconciled_days = reconcile_plan_completions(conn, today_local)

    if (
        sync_to_garmin
        and uploaded_workouts > 0
        and hasattr(garmin_client, "send_scheduled_workouts_to_devices")
    ):
        garmin_client.send_scheduled_workouts_to_devices()

    return PlanApplyResult(
        plan_id=plan_id,
        plan_name=plan_spec.name,
        total_days=len(plan_spec.days),
        preserved_past_days=preserved_past_days,
        deleted_workouts=deleted_workouts,
        uploaded_workouts=uploaded_workouts,
        reconciled_days=reconciled_days,
        stammdaten_rows=stammdaten_rows,
    )


def sync_future_plan_conn(
    conn: sqlite3.Connection,
    garmin_client: GarminClient,
    today_local: date,
    *,
    force: bool = False,
) -> int:
    """Upload and schedule pending future plan workouts using an open SQLite connection."""
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

    uploaded_count = 0
    now_iso = datetime.now(UTC).isoformat()

    live_schedule_ids: set[int] | None = None
    if not force and rows and hasattr(garmin_client, "get_scheduled_workouts_by_period"):
        end_date_str = str(rows[-1]["date"])
        live_items = garmin_client.get_scheduled_workouts_by_period(
            today_local.isoformat(),
            end_date_str,
        )
        if live_items is not None:
            live_schedule_ids = {
                int(item["workoutScheduleId"])
                for item in live_items
                if item.get("workoutScheduleId") is not None
            }

    for row in rows:
        has_valid_schedule = (
            row["garmin_workout_id"] is not None
            and row["garmin_schedule_id"] is not None
            and (live_schedule_ids is None or int(row["garmin_schedule_id"]) in live_schedule_ids)
        )
        if not force and has_valid_schedule:
            continue
        if row["garmin_workout_id"] is not None or row["garmin_schedule_id"] is not None:
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

    if (uploaded_count > 0 or rows) and hasattr(
        garmin_client, "send_scheduled_workouts_to_devices"
    ):
        garmin_client.send_scheduled_workouts_to_devices()

    return uploaded_count


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

    with connect_db(settings.database_path) as conn:
        return sync_future_plan_conn(conn, garmin_client, today_local, force=force)


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
        stamm_rows = get_stammdaten(conn)

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
                    actual_km=r.get("actual_km"),
                    actual_duration_min=r.get("actual_duration_min"),
                    actual_avg_hr=r.get("actual_avg_hr"),
                    actual_max_hr=r.get("actual_max_hr"),
                    actual_pace_min_per_km=r.get("actual_pace_min_per_km"),
                    actual_cadence_spm=r.get("actual_cadence_spm"),
                    actual_stride_m=r.get("actual_stride_m"),
                    actual_power_w=r.get("actual_power_w"),
                    actual_training_load=r.get("actual_training_load"),
                    actual_aerobic_te=r.get("actual_aerobic_te"),
                    actual_anaerobic_te=r.get("actual_anaerobic_te"),
                    actual_calories=r.get("actual_calories"),
                    rpe=r.get("rpe"),
                    notes=r.get("notes"),
                )
            )
        stamm_spec = (
            [
                StammdatenEntrySpec(
                    category=str(s["category"]),
                    parameter=str(s["parameter"]),
                    value=str(s["value"]),
                    unit_or_range=s.get("unit_or_range"),
                    reference_note=s.get("reference_note"),
                )
                for s in stamm_rows
            ]
            if stamm_rows
            else None
        )
        spec = TrainingPlanSpec(
            name=str(plan_row["name"]),
            notes=plan_row["notes"],
            stammdaten=stamm_spec,
            days=days_spec,
        )
        return dump_plan_to_yaml(spec)


def update_plan_day_notes(
    settings: Settings,
    day_date: str,
    notes: str | None,
) -> RowDict | None:
    """Update the notes field for a single plan day in SQLite and refresh active plan YAML."""
    init_db(settings.database_path)
    cleaned_notes = notes.strip() if isinstance(notes, str) and notes.strip() else None
    now_iso = datetime.now(UTC).isoformat()

    with connect_db(settings.database_path) as conn:
        plan_row = conn.execute(
            "SELECT id FROM training_plans WHERE is_active = 1 ORDER BY id DESC LIMIT 1"
        ).fetchone()
        if plan_row is None:
            return None
        plan_id = int(plan_row["id"])
        cursor = conn.execute(
            """
            UPDATE plan_days
            SET notes = ?, updated_at = ?
            WHERE plan_id = ? AND date = ?
            """,
            (cleaned_notes, now_iso, plan_id, day_date),
        )
        if cursor.rowcount == 0:
            return None
        updated_row = conn.execute(
            "SELECT * FROM plan_days WHERE plan_id = ? AND date = ?",
            (plan_id, day_date),
        ).fetchone()

    try:
        updated_yaml = export_active_plan_yaml(settings)
        with connect_db(settings.database_path) as conn:
            conn.execute(
                "UPDATE training_plans SET raw_yaml = ?, updated_at = ? WHERE id = ?",
                (updated_yaml, now_iso, plan_id),
            )
        plan_yaml_path = settings.database_path.parent / "plan.yaml"
        if plan_yaml_path.exists():
            plan_yaml_path.write_text(updated_yaml, encoding="utf-8")
    except Exception as exc:
        logger.debug(f"Could not refresh exported YAML after notes update: {exc}")

    return dict(updated_row) if updated_row is not None else None
