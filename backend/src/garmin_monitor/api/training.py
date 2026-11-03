"""Training dashboard and training plan REST endpoints (/api/training/*)."""

import asyncio
from datetime import date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from garmin_monitor.config import Settings
from garmin_monitor.db import connect_db, init_db
from garmin_monitor.plan_schema import PlanDayStatus, SportType
from garmin_monitor.plan_service import (
    get_active_plan_with_days,
    reconcile_plan_completions,
    sync_future_plan_to_garmin,
)

router = APIRouter(prefix="/api/training", tags=["training"])


class CompletedWorkoutItem(BaseModel):
    """Completed activity item for the current ISO week."""

    activity_id: int
    activity_name: str
    sport_type: str
    start_time_local: str
    date_local: str
    duration_min: float
    distance_km: float
    avg_hr: int | None = None
    max_hr: int | None = None
    calories: int | None = None
    training_load: float | None = None


class WeeklyTrainingPoint(BaseModel):
    """Aggregated ISO-week training totals for ECharts diagrams."""

    iso_week_label: str
    week_start: str
    week_end: str
    running_km: float
    strength_minutes: float
    workout_count: int


class TrainingDashboardResponse(BaseModel):
    """Response payload for GET /api/training/dashboard."""

    reference_date: str
    current_week_start: str
    current_week_end: str
    ran_km_this_week: float
    strength_minutes_this_week: float
    completed_workouts_this_week: int
    current_week_activities: list[CompletedWorkoutItem]
    weekly_series: list[WeeklyTrainingPoint]


class PlanDayItem(BaseModel):
    """Single row in the /training Plan tab table."""

    date: str
    sport_type: SportType
    workout_title: str
    focus: str | None = None
    goal_km: float | None = None
    goal_duration_min: float | None = None
    hr_goal_label: str | None = None
    hr_min: int | None = None
    hr_max: int | None = None
    actual_km: float | None = None
    actual_duration_min: float | None = None
    actual_avg_hr: int | None = None
    actual_max_hr: int | None = None
    garmin_workout_id: int | None = None
    garmin_schedule_id: int | None = None
    status: PlanDayStatus


class TrainingPlanResponse(BaseModel):
    """Response payload for GET /api/training/plan."""

    has_active_plan: bool
    plan_id: int | None = None
    name: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    notes: str | None = None
    updated_at: str | None = None
    days: list[PlanDayItem]


class PlanSyncResponse(BaseModel):
    """Response payload for POST /api/training/plan/sync."""

    uploaded_workouts: int


def _iso_week_monday(d: date) -> date:
    """Return the Monday date of the ISO-8601 week containing d."""
    return d - timedelta(days=d.weekday())


@router.get("/dashboard", response_model=TrainingDashboardResponse)
async def get_training_dashboard(
    request: Request,
    weeks: Annotated[int, Query(ge=1, le=52)] = 12,
    reference_date: date | None = None,
) -> TrainingDashboardResponse:
    """Return current ISO-week KPIs, completed workouts, and multi-week ECharts series."""
    settings: Settings = request.app.state.settings
    init_db(settings.database_path)
    today_local = reference_date or datetime.now(settings.timezone).date()
    current_monday = _iso_week_monday(today_local)
    current_sunday = current_monday + timedelta(days=6)
    earliest_monday = current_monday - timedelta(weeks=weeks - 1)

    with connect_db(settings.database_path) as conn:
        rows = conn.execute(
            """
            SELECT * FROM activities
            WHERE date_local >= ? AND date_local <= ?
            ORDER BY start_time_local DESC
            """,
            (earliest_monday.isoformat(), current_sunday.isoformat()),
        ).fetchall()

    week_buckets: dict[date, list[dict[str, object]]] = {
        earliest_monday + timedelta(weeks=idx): [] for idx in range(weeks)
    }
    for row in rows:
        row_dict = dict(row)
        act_date = date.fromisoformat(str(row_dict["date_local"]))
        monday = _iso_week_monday(act_date)
        if monday in week_buckets:
            week_buckets[monday].append(row_dict)

    weekly_series: list[WeeklyTrainingPoint] = []
    for monday in sorted(week_buckets.keys()):
        sunday = monday + timedelta(days=6)
        iso_year, iso_week, _ = monday.isocalendar()
        acts = week_buckets[monday]
        run_km = round(
            sum(
                float(a.get("distance_m") or 0.0) / 1000.0
                for a in acts
                if a.get("sport_type") == "running"
            ),
            2,
        )
        strength_min = round(
            sum(
                float(a.get("duration_sec") or 0.0) / 60.0
                for a in acts
                if a.get("sport_type") == "strength_training"
            ),
            1,
        )
        weekly_series.append(
            WeeklyTrainingPoint(
                iso_week_label=f"{iso_year}-W{iso_week:02d}",
                week_start=monday.isoformat(),
                week_end=sunday.isoformat(),
                running_km=run_km,
                strength_minutes=strength_min,
                workout_count=len(acts),
            )
        )

    current_acts = week_buckets.get(current_monday, [])
    current_week_items = [
        CompletedWorkoutItem(
            activity_id=int(a["activity_id"]),  # type: ignore[arg-type]
            activity_name=str(a["activity_name"]),
            sport_type=str(a["sport_type"]),
            start_time_local=str(a["start_time_local"]),
            date_local=str(a["date_local"]),
            duration_min=round(float(a.get("duration_sec") or 0.0) / 60.0, 1),
            distance_km=round(float(a.get("distance_m") or 0.0) / 1000.0, 2),
            avg_hr=int(a["avg_hr"]) if a.get("avg_hr") is not None else None,  # type: ignore[arg-type]
            max_hr=int(a["max_hr"]) if a.get("max_hr") is not None else None,  # type: ignore[arg-type]
            calories=int(a["calories"]) if a.get("calories") is not None else None,  # type: ignore[arg-type]
            training_load=(
                round(float(a["training_load"]), 1)  # type: ignore[arg-type]
                if a.get("training_load") is not None
                else None
            ),
        )
        for a in current_acts
    ]
    current_point = weekly_series[-1]

    return TrainingDashboardResponse(
        reference_date=today_local.isoformat(),
        current_week_start=current_monday.isoformat(),
        current_week_end=current_sunday.isoformat(),
        ran_km_this_week=current_point.running_km,
        strength_minutes_this_week=current_point.strength_minutes,
        completed_workouts_this_week=current_point.workout_count,
        current_week_activities=current_week_items,
        weekly_series=weekly_series,
    )


@router.get("/plan", response_model=TrainingPlanResponse)
async def get_training_plan(
    request: Request,
    reference_date: date | None = None,
) -> TrainingPlanResponse:
    """Return the active training plan with both planned targets and reconciled actuals."""
    settings: Settings = request.app.state.settings
    init_db(settings.database_path)
    today_local = reference_date or datetime.now(settings.timezone).date()

    with connect_db(settings.database_path) as conn:
        reconcile_plan_completions(conn, today_local)
        plan_row, day_rows = get_active_plan_with_days(conn)

    if plan_row is None:
        return TrainingPlanResponse(has_active_plan=False, days=[])

    days = [
        PlanDayItem(
            date=str(r["date"]),
            sport_type=r["sport_type"],
            workout_title=str(r["workout_title"]),
            focus=r.get("focus"),
            goal_km=float(r["goal_km"]) if r.get("goal_km") is not None else None,
            goal_duration_min=(
                float(r["goal_duration_min"]) if r.get("goal_duration_min") is not None else None
            ),
            hr_goal_label=r.get("hr_goal_label"),
            hr_min=int(r["hr_min"]) if r.get("hr_min") is not None else None,
            hr_max=int(r["hr_max"]) if r.get("hr_max") is not None else None,
            actual_km=float(r["actual_km"]) if r.get("actual_km") is not None else None,
            actual_duration_min=(
                float(r["actual_duration_min"])
                if r.get("actual_duration_min") is not None
                else None
            ),
            actual_avg_hr=(int(r["actual_avg_hr"]) if r.get("actual_avg_hr") is not None else None),
            actual_max_hr=(int(r["actual_max_hr"]) if r.get("actual_max_hr") is not None else None),
            garmin_workout_id=(
                int(r["garmin_workout_id"]) if r.get("garmin_workout_id") is not None else None
            ),
            garmin_schedule_id=(
                int(r["garmin_schedule_id"]) if r.get("garmin_schedule_id") is not None else None
            ),
            status=r["status"],
        )
        for r in day_rows
    ]

    return TrainingPlanResponse(
        has_active_plan=True,
        plan_id=int(plan_row["id"]),
        name=str(plan_row["name"]),
        start_date=str(plan_row["start_date"]),
        end_date=str(plan_row["end_date"]),
        notes=plan_row.get("notes"),
        updated_at=str(plan_row["updated_at"]),
        days=days,
    )


@router.post("/plan/sync", response_model=PlanSyncResponse)
async def sync_plan_endpoint(
    request: Request,
    force: bool = False,
) -> PlanSyncResponse:
    """Upload and calendar-schedule pending future plan workouts to Garmin Connect."""
    settings: Settings = request.app.state.settings
    try:
        uploaded = await asyncio.to_thread(sync_future_plan_to_garmin, settings, force=force)
        return PlanSyncResponse(uploaded_workouts=uploaded)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to sync training plan to Garmin Connect: {exc}",
        ) from exc
