"""Training dashboard and training plan REST endpoints (/api/training/*)."""

import asyncio
import json
import math
from datetime import date, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from garmin_monitor.config import Settings
from garmin_monitor.db import connect_db, init_db
from garmin_monitor.plan_schema import PlanDayStatus, SportType
from garmin_monitor.plan_service import (
    get_active_plan_with_days,
    get_stammdaten,
    reconcile_plan_completions,
    sync_future_plan_to_garmin,
    update_plan_day_notes,
)

router = APIRouter(prefix="/api/training", tags=["training"])

RACE_DISTANCES: tuple[tuple[str, str, float, str, float], ...] = (
    ("5k", "5 km", 5.0, "time5K", 0.935),
    ("10k", "10 km", 10.0, "time10K", 0.895),
    ("half_marathon", "Halbmarathon", 21.0975, "timeHalfMarathon", 0.845),
    ("marathon", "Marathon", 42.195, "timeMarathon", 0.790),
)

HR_ZONE_SPECS: tuple[tuple[int, str, str, float], ...] = (
    (1, "Z1 · Regeneration", "< 140 bpm", 10.0),
    (2, "Z2 · GAT1 Basis", "140-155 bpm", 65.0),
    (3, "Z3 · GAT2 Grauzone", "155-172 bpm", 10.0),
    (4, "Z4 · GAT3 Schwelle", "172-182 bpm", 10.0),
    (5, "Z5 · WSA VO2max", "> 182 bpm", 5.0),
)


class CompletedWorkoutItem(BaseModel):
    """Completed activity item for the selected window or current ISO week."""

    activity_id: int
    activity_name: str
    sport_type: str
    start_time_local: str
    date_local: str
    duration_min: float
    distance_km: float
    avg_pace_sec_per_km: int | None = None
    avg_pace_min_per_km: str | None = None
    avg_cadence_spm: int | None = None
    max_cadence_spm: int | None = None
    avg_stride_m: float | None = None
    avg_power_w: int | None = None
    norm_power_w: int | None = None
    avg_gct_ms: int | None = None
    avg_vertical_oscillation_cm: float | None = None
    avg_vertical_ratio_pct: float | None = None
    vo2_max: float | None = None
    training_effect_label: str | None = None
    total_sets: int | None = None
    total_reps: int | None = None
    hr_zone_1_min: float = 0.0
    hr_zone_2_min: float = 0.0
    hr_zone_3_min: float = 0.0
    hr_zone_4_min: float = 0.0
    hr_zone_5_min: float = 0.0
    elevation_gain_m: float | None = None
    aerobic_te: float | None = None
    anaerobic_te: float | None = None
    steps: int | None = None
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
    training_load: float = 0.0
    hr_zone_1_min: float = 0.0
    hr_zone_2_min: float = 0.0
    hr_zone_3_min: float = 0.0
    hr_zone_4_min: float = 0.0
    hr_zone_5_min: float = 0.0


class Vo2MaxPoint(BaseModel):
    """Single chronological VO2 max reading for progression diagrams."""

    date: str
    vo2_max: float
    sport_type: str = "running"


class RacePredictionItem(BaseModel):
    """Predicted race finish time and pace for a standard distance."""

    distance_key: str
    label: str
    distance_km: float
    predicted_seconds: int
    predicted_time_label: str
    predicted_pace_min_per_km: str


class RacePredictionsSummary(BaseModel):
    """Race predictions for 5K, 10K, Half Marathon, and Marathon."""

    as_of_date: str | None = None
    vo2_max_used: float | None = None
    source: str = "garmin"
    items: list[RacePredictionItem] = []


class HrZoneWindowItem(BaseModel):
    """Aggregated HR zone duration and share across the selected window."""

    zone: int
    label: str
    bpm_range: str
    minutes: float
    percentage: float
    target_percentage: float


class TrainingDashboardResponse(BaseModel):
    """Response payload for GET /api/training/dashboard."""

    reference_date: str
    days_requested: int = 30
    window_start: str = ""
    window_end: str = ""
    ran_km_window: float = 0.0
    strength_minutes_window: float = 0.0
    completed_workouts_window: int = 0
    window_activities: list[CompletedWorkoutItem] = []
    current_week_start: str
    current_week_end: str
    ran_km_this_week: float
    strength_minutes_this_week: float
    completed_workouts_this_week: int
    current_week_activities: list[CompletedWorkoutItem]
    weekly_series: list[WeeklyTrainingPoint]
    vo2_max_latest: float | None = None
    vo2_max_delta: float | None = None
    vo2_max_series: list[Vo2MaxPoint] = []
    race_predictions: RacePredictionsSummary | None = None
    hr_zones_window: list[HrZoneWindowItem] = []


class StammdatenItem(BaseModel):
    """Single row of athlete master data / performance diagnostics (Stammdaten)."""

    category: str
    parameter: str
    value: str
    unit_or_range: str | None = None
    reference_note: str | None = None


class StammdatenResponse(BaseModel):
    """Response payload for GET /api/training/stammdaten."""

    items: list[StammdatenItem]
    updated_at: str | None = None


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
    actual_pace_min_per_km: str | None = None
    actual_cadence_spm: int | None = None
    actual_stride_m: float | None = None
    actual_power_w: int | None = None
    actual_training_load: float | None = None
    actual_aerobic_te: float | None = None
    actual_anaerobic_te: float | None = None
    actual_calories: int | None = None
    rpe: int | None = None
    notes: str | None = None
    garmin_workout_id: int | None = None
    garmin_schedule_id: int | None = None
    status: PlanDayStatus


class PlanDayNotesUpdateRequest(BaseModel):
    """Request body for PATCH /api/training/plan/days/{day_date}/notes."""

    notes: str | None = None


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
    stammdaten: list[StammdatenItem] = []


class PlanSyncResponse(BaseModel):
    """Response payload for POST /api/training/plan/sync."""

    uploaded_workouts: int


def _iso_week_monday(d: date) -> date:
    """Return the Monday date of the ISO-8601 week containing d."""
    return d - timedelta(days=d.weekday())


def _opt_round_int(val: Any) -> int | None:
    if val is None or isinstance(val, bool):
        return None
    try:
        return round(float(val))
    except TypeError, ValueError:
        return None


def _opt_round_float(val: Any, decimals: int = 1) -> float | None:
    if val is None or isinstance(val, bool):
        return None
    try:
        return round(float(val), decimals)
    except TypeError, ValueError:
        return None


def _parse_raw_payload(raw_json_str: object) -> dict[str, Any]:
    if isinstance(raw_json_str, str) and raw_json_str.strip():
        try:
            parsed = json.loads(raw_json_str)
            if isinstance(parsed, dict):
                return parsed
        except ValueError:
            pass
    return {}


def _format_duration_clock(total_seconds: int) -> str:
    hrs, rem = divmod(max(0, total_seconds), 3600)
    mins, secs = divmod(rem, 60)
    if hrs > 0:
        return f"{hrs}:{mins:02d}:{secs:02d}"
    return f"{mins}:{secs:02d}"


def _format_pace_clock(total_seconds: int, distance_km: float) -> str:
    if distance_km <= 0:
        return "-"
    pace_sec = round(total_seconds / distance_km)
    return f"{pace_sec // 60}:{pace_sec % 60:02d}"


def _estimate_race_seconds_from_vo2max(vo2_max: float, distance_km: float, pct_vo2: float) -> int:
    """Estimate race finish seconds from VO2 max using Daniels/Firstbeat oxygen-cost velocity."""
    vo2_race = max(20.0, vo2_max * pct_vo2)
    a = 0.000104
    b = 0.182258
    c = -4.60 - vo2_race
    discriminant = max(0.0, b * b - 4.0 * a * c)
    velocity_m_per_min = (-b + math.sqrt(discriminant)) / (2.0 * a)
    if velocity_m_per_min <= 0:
        return 0
    return round(((distance_km * 1000.0) / velocity_m_per_min) * 60.0)


def _build_race_predictions(
    latest_vo2: float | None,
    latest_vo2_date: str | None,
    health_rows: list[dict[str, Any]],
) -> RacePredictionsSummary | None:
    for h_row in reversed(health_rows):
        bundle = _parse_raw_payload(h_row.get("raw_json"))
        rp_raw = bundle.get("race_predictions")
        rp_entry: dict[str, Any] = {}
        if isinstance(rp_raw, list) and rp_raw and isinstance(rp_raw[-1], dict):
            rp_entry = rp_raw[-1]
        elif isinstance(rp_raw, dict):
            rp_entry = rp_raw
        if rp_entry and rp_entry.get("time5K"):
            items: list[RacePredictionItem] = []
            for key, label, dist_km, garmin_field, _pct in RACE_DISTANCES:
                sec = _opt_round_int(rp_entry.get(garmin_field))
                if sec and sec > 0:
                    items.append(
                        RacePredictionItem(
                            distance_key=key,
                            label=label,
                            distance_km=dist_km,
                            predicted_seconds=sec,
                            predicted_time_label=_format_duration_clock(sec),
                            predicted_pace_min_per_km=_format_pace_clock(sec, dist_km),
                        )
                    )
            if items:
                return RacePredictionsSummary(
                    as_of_date=str(rp_entry.get("calendarDate") or h_row.get("date")),
                    vo2_max_used=latest_vo2,
                    source="garmin",
                    items=items,
                )

    if latest_vo2 is None or latest_vo2 <= 0:
        return None

    est_items = [
        RacePredictionItem(
            distance_key=key,
            label=label,
            distance_km=dist_km,
            predicted_seconds=(sec := _estimate_race_seconds_from_vo2max(latest_vo2, dist_km, pct)),
            predicted_time_label=_format_duration_clock(sec),
            predicted_pace_min_per_km=_format_pace_clock(sec, dist_km),
        )
        for key, label, dist_km, _field, pct in RACE_DISTANCES
    ]
    return RacePredictionsSummary(
        as_of_date=latest_vo2_date,
        vo2_max_used=latest_vo2,
        source="vo2max_model",
        items=est_items,
    )


def _to_completed_workout_item(a: dict[str, object]) -> CompletedWorkoutItem:
    duration_sec = float(a.get("duration_sec") or 0.0)
    distance_m = float(a.get("distance_m") or 0.0)
    avg_speed_mps = float(a.get("avg_speed_mps") or 0.0)

    pace_sec: int | None = None
    pace_str: str | None = None
    if distance_m > 0 and (avg_speed_mps > 0 or duration_sec > 0):
        raw_pace_sec = (
            1000.0 / avg_speed_mps if avg_speed_mps > 0 else duration_sec / (distance_m / 1000.0)
        )
        if 60.0 <= raw_pace_sec <= 3600.0:
            pace_sec = round(raw_pace_sec)
            pace_str = f"{pace_sec // 60}:{pace_sec % 60:02d}"

    raw_payload = _parse_raw_payload(a.get("raw_json"))

    stride_cm = _opt_round_float(raw_payload.get("avgStrideLength"), 2)
    avg_stride_m = round(stride_cm / 100.0, 2) if stride_cm is not None and stride_cm > 0 else None

    z1_min = round(float(raw_payload.get("hrTimeInZone_1") or 0.0) / 60.0, 1)
    z2_min = round(float(raw_payload.get("hrTimeInZone_2") or 0.0) / 60.0, 1)
    z3_min = round(float(raw_payload.get("hrTimeInZone_3") or 0.0) / 60.0, 1)
    z4_min = round(float(raw_payload.get("hrTimeInZone_4") or 0.0) / 60.0, 1)
    z5_min = round(float(raw_payload.get("hrTimeInZone_5") or 0.0) / 60.0, 1)

    raw_sets = _opt_round_int(raw_payload.get("activeSets") or raw_payload.get("totalSets"))
    raw_reps = _opt_round_int(raw_payload.get("totalReps"))
    if raw_sets is not None and raw_sets <= 1 and (raw_reps is None or raw_reps <= 0):
        total_sets = None
        total_reps = None
    else:
        total_sets = raw_sets if raw_sets is not None and raw_sets > 0 else None
        total_reps = raw_reps if raw_reps is not None and raw_reps > 0 else None

    return CompletedWorkoutItem(
        activity_id=int(a["activity_id"]),  # type: ignore[arg-type]
        activity_name=str(a["activity_name"]),
        sport_type=str(a["sport_type"]),
        start_time_local=str(a["start_time_local"]),
        date_local=str(a["date_local"]),
        duration_min=round(duration_sec / 60.0, 1),
        distance_km=round(distance_m / 1000.0, 2),
        avg_pace_sec_per_km=pace_sec,
        avg_pace_min_per_km=pace_str,
        avg_cadence_spm=_opt_round_int(raw_payload.get("averageRunningCadenceInStepsPerMinute")),
        max_cadence_spm=_opt_round_int(raw_payload.get("maxRunningCadenceInStepsPerMinute")),
        avg_stride_m=avg_stride_m,
        avg_power_w=_opt_round_int(raw_payload.get("avgPower")),
        norm_power_w=_opt_round_int(raw_payload.get("normPower")),
        avg_gct_ms=_opt_round_int(raw_payload.get("avgGroundContactTime")),
        avg_vertical_oscillation_cm=_opt_round_float(raw_payload.get("avgVerticalOscillation"), 1),
        avg_vertical_ratio_pct=_opt_round_float(raw_payload.get("avgVerticalRatio"), 1),
        vo2_max=_opt_round_float(raw_payload.get("vO2MaxValue"), 1),
        training_effect_label=(
            str(raw_payload["trainingEffectLabel"])
            if raw_payload.get("trainingEffectLabel")
            else None
        ),
        total_sets=total_sets,
        total_reps=total_reps,
        hr_zone_1_min=z1_min,
        hr_zone_2_min=z2_min,
        hr_zone_3_min=z3_min,
        hr_zone_4_min=z4_min,
        hr_zone_5_min=z5_min,
        elevation_gain_m=_opt_round_float(
            a.get("elevation_gain_m")
            if a.get("elevation_gain_m") is not None
            else raw_payload.get("elevationGain"),
            0,
        ),
        aerobic_te=_opt_round_float(
            a.get("aerobic_te")
            if a.get("aerobic_te") is not None
            else raw_payload.get("aerobicTrainingEffect"),
            1,
        ),
        anaerobic_te=_opt_round_float(
            a.get("anaerobic_te")
            if a.get("anaerobic_te") is not None
            else raw_payload.get("anaerobicTrainingEffect"),
            1,
        ),
        steps=_opt_round_int(raw_payload.get("steps")),
        avg_hr=int(a["avg_hr"]) if a.get("avg_hr") is not None else None,  # type: ignore[arg-type]
        max_hr=int(a["max_hr"]) if a.get("max_hr") is not None else None,  # type: ignore[arg-type]
        calories=int(a["calories"]) if a.get("calories") is not None else None,  # type: ignore[arg-type]
        training_load=(
            round(float(a["training_load"]), 1)  # type: ignore[arg-type]
            if a.get("training_load") is not None
            else None
        ),
    )


@router.get("/dashboard", response_model=TrainingDashboardResponse)
async def get_training_dashboard(
    request: Request,
    days: Annotated[int | None, Query(ge=1, le=365)] = None,
    weeks: Annotated[int, Query(ge=1, le=52)] = 12,
    reference_date: date | None = None,
) -> TrainingDashboardResponse:
    """Return time-window KPIs, completed workouts, and multi-week ECharts series."""
    settings: Settings = request.app.state.settings
    init_db(settings.database_path)
    today_local = reference_date or datetime.now(settings.timezone).date()
    current_monday = _iso_week_monday(today_local)
    current_sunday = current_monday + timedelta(days=6)

    if days is not None:
        effective_days = days
        window_start_date = today_local - timedelta(days=effective_days - 1)
        window_end_date = today_local
        earliest_monday = _iso_week_monday(window_start_date)
        num_weeks = ((current_monday - earliest_monday).days // 7) + 1
    else:
        effective_days = weeks * 7
        earliest_monday = current_monday - timedelta(weeks=weeks - 1)
        window_start_date = earliest_monday
        window_end_date = current_sunday
        num_weeks = weeks

    query_start = min(earliest_monday, window_start_date)
    query_end = max(current_sunday, window_end_date)
    history_start = min(query_start, today_local - timedelta(days=90))

    with connect_db(settings.database_path) as conn:
        all_rows = conn.execute(
            """
            SELECT * FROM activities
            WHERE date_local >= ? AND date_local <= ?
            ORDER BY start_time_local DESC
            """,
            (history_start.isoformat(), query_end.isoformat()),
        ).fetchall()
        health_rows_raw = conn.execute(
            """
            SELECT date, raw_json FROM daily_health
            WHERE date >= ? AND date <= ?
            ORDER BY date ASC
            """,
            (history_start.isoformat(), query_end.isoformat()),
        ).fetchall()

    rows = [
        r for r in all_rows if query_start <= date.fromisoformat(str(r["date_local"])) <= query_end
    ]
    health_rows = [dict(r) for r in health_rows_raw]

    week_buckets: dict[date, list[dict[str, object]]] = {
        earliest_monday + timedelta(weeks=idx): [] for idx in range(num_weeks)
    }
    window_acts: list[dict[str, object]] = []
    for row in rows:
        row_dict = dict(row)
        act_date = date.fromisoformat(str(row_dict["date_local"]))
        if window_start_date <= act_date <= window_end_date:
            window_acts.append(row_dict)
        monday = _iso_week_monday(act_date)
        if monday in week_buckets:
            if days is None or (window_start_date <= act_date <= window_end_date):
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
        week_load = round(
            sum(float(a.get("training_load") or 0.0) for a in acts),
            1,
        )
        zone_source_acts = [a for a in acts if a.get("sport_type") == "running"] or acts
        wk_zones = [0.0, 0.0, 0.0, 0.0, 0.0]
        for a in zone_source_acts:
            payload = _parse_raw_payload(a.get("raw_json"))
            for idx in range(5):
                wk_zones[idx] += float(payload.get(f"hrTimeInZone_{idx + 1}") or 0.0) / 60.0

        weekly_series.append(
            WeeklyTrainingPoint(
                iso_week_label=f"{iso_year}-W{iso_week:02d}",
                week_start=monday.isoformat(),
                week_end=sunday.isoformat(),
                running_km=run_km,
                strength_minutes=strength_min,
                workout_count=len(acts),
                training_load=week_load,
                hr_zone_1_min=round(wk_zones[0], 1),
                hr_zone_2_min=round(wk_zones[1], 1),
                hr_zone_3_min=round(wk_zones[2], 1),
                hr_zone_4_min=round(wk_zones[3], 1),
                hr_zone_5_min=round(wk_zones[4], 1),
            )
        )

    current_acts = [
        dict(r)
        for r in rows
        if current_monday <= date.fromisoformat(str(r["date_local"])) <= current_sunday
    ]
    current_week_items = [_to_completed_workout_item(a) for a in current_acts]
    window_items = [_to_completed_workout_item(a) for a in window_acts]

    # Build HR zones summary across running sessions in the selected window
    run_window_items = [item for item in window_items if item.sport_type == "running"]
    zone_items_source = run_window_items if run_window_items else window_items
    zone_mins = [
        round(sum(getattr(it, f"hr_zone_{z}_min") for it in zone_items_source), 1)
        for z in range(1, 6)
    ]
    total_zone_min = sum(zone_mins)
    hr_zones_window = [
        HrZoneWindowItem(
            zone=z_num,
            label=z_label,
            bpm_range=z_bpm,
            minutes=zone_mins[z_num - 1],
            percentage=(
                round((zone_mins[z_num - 1] / total_zone_min) * 100.0, 1)
                if total_zone_min > 0
                else 0.0
            ),
            target_percentage=z_target,
        )
        for z_num, z_label, z_bpm, z_target in HR_ZONE_SPECS
    ]

    # Build chronological VO2 max series across history_start..window_end_date
    vo2_by_date: dict[str, Vo2MaxPoint] = {}
    for row in reversed(all_rows):
        row_d = dict(row)
        dt_str = str(row_d["date_local"])
        if date.fromisoformat(dt_str) > window_end_date:
            continue
        payload = _parse_raw_payload(row_d.get("raw_json"))
        vo2_val = _opt_round_float(payload.get("vO2MaxValue"), 1)
        sp_type = str(row_d.get("sport_type") or "running")
        if vo2_val is not None and vo2_val > 0:
            existing = vo2_by_date.get(dt_str)
            if existing is None or sp_type == "running":
                vo2_by_date[dt_str] = Vo2MaxPoint(
                    date=dt_str,
                    vo2_max=vo2_val,
                    sport_type=sp_type,
                )

    for h_row in health_rows:
        dt_str = str(h_row["date"])
        if date.fromisoformat(dt_str) > window_end_date:
            continue
        bundle = _parse_raw_payload(h_row.get("raw_json"))
        mm_raw = bundle.get("max_metrics")
        mm_entry: dict[str, Any] = {}
        if isinstance(mm_raw, list) and mm_raw and isinstance(mm_raw[0], dict):
            mm_entry = mm_raw[0]
        elif isinstance(mm_raw, dict):
            mm_entry = mm_raw
        generic = mm_entry.get("generic") if isinstance(mm_entry.get("generic"), dict) else {}
        precise = _opt_round_float(
            generic.get("vo2MaxPreciseValue") or generic.get("vo2MaxValue"),
            1,
        )
        if precise is not None and precise > 0:
            vo2_by_date[dt_str] = Vo2MaxPoint(
                date=dt_str,
                vo2_max=precise,
                sport_type="running",
            )

    raw_vo2_points = [vo2_by_date[k] for k in sorted(vo2_by_date.keys())]
    run_vo2_points = [pt for pt in raw_vo2_points if "run" in pt.sport_type.lower()]
    all_vo2_points = run_vo2_points if run_vo2_points else raw_vo2_points
    window_vo2_points = [
        pt for pt in all_vo2_points if date.fromisoformat(pt.date) >= window_start_date
    ]
    vo2_max_series = window_vo2_points if len(window_vo2_points) >= 3 else all_vo2_points[-8:]
    vo2_max_latest = all_vo2_points[-1].vo2_max if all_vo2_points else None
    latest_vo2_date = all_vo2_points[-1].date if all_vo2_points else None
    vo2_max_delta = (
        round(vo2_max_series[-1].vo2_max - vo2_max_series[0].vo2_max, 1)
        if len(vo2_max_series) >= 2
        else (0.0 if vo2_max_series else None)
    )
    race_predictions = _build_race_predictions(vo2_max_latest, latest_vo2_date, health_rows)

    ran_km_window = round(
        sum(
            float(a.get("distance_m") or 0.0) / 1000.0
            for a in window_acts
            if a.get("sport_type") == "running"
        ),
        2,
    )
    strength_min_window = round(
        sum(
            float(a.get("duration_sec") or 0.0) / 60.0
            for a in window_acts
            if a.get("sport_type") == "strength_training"
        ),
        1,
    )
    ran_km_this_week = round(
        sum(
            float(a.get("distance_m") or 0.0) / 1000.0
            for a in current_acts
            if a.get("sport_type") == "running"
        ),
        2,
    )
    strength_min_this_week = round(
        sum(
            float(a.get("duration_sec") or 0.0) / 60.0
            for a in current_acts
            if a.get("sport_type") == "strength_training"
        ),
        1,
    )

    return TrainingDashboardResponse(
        reference_date=today_local.isoformat(),
        days_requested=effective_days,
        window_start=window_start_date.isoformat(),
        window_end=window_end_date.isoformat(),
        ran_km_window=ran_km_window,
        strength_minutes_window=strength_min_window,
        completed_workouts_window=len(window_items),
        window_activities=window_items,
        current_week_start=current_monday.isoformat(),
        current_week_end=current_sunday.isoformat(),
        ran_km_this_week=ran_km_this_week,
        strength_minutes_this_week=strength_min_this_week,
        completed_workouts_this_week=len(current_week_items),
        current_week_activities=current_week_items,
        weekly_series=weekly_series,
        vo2_max_latest=vo2_max_latest,
        vo2_max_delta=vo2_max_delta,
        vo2_max_series=vo2_max_series,
        race_predictions=race_predictions,
        hr_zones_window=hr_zones_window,
    )


@router.get("/stammdaten", response_model=StammdatenResponse)
async def get_training_stammdaten(request: Request) -> StammdatenResponse:
    """Return athlete master data & performance diagnostics (Stammdaten)."""
    settings: Settings = request.app.state.settings
    init_db(settings.database_path)
    with connect_db(settings.database_path) as conn:
        rows = get_stammdaten(conn)

    items = [
        StammdatenItem(
            category=str(r["category"]),
            parameter=str(r["parameter"]),
            value=str(r["value"]),
            unit_or_range=r.get("unit_or_range"),
            reference_note=r.get("reference_note"),
        )
        for r in rows
    ]
    updated_at = str(rows[0]["updated_at"]) if rows and rows[0].get("updated_at") else None
    return StammdatenResponse(items=items, updated_at=updated_at)


def _row_to_plan_day_item(r: dict[str, Any]) -> PlanDayItem:
    return PlanDayItem(
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
            float(r["actual_duration_min"]) if r.get("actual_duration_min") is not None else None
        ),
        actual_avg_hr=int(r["actual_avg_hr"]) if r.get("actual_avg_hr") is not None else None,
        actual_max_hr=int(r["actual_max_hr"]) if r.get("actual_max_hr") is not None else None,
        actual_pace_min_per_km=r.get("actual_pace_min_per_km"),
        actual_cadence_spm=(
            int(r["actual_cadence_spm"]) if r.get("actual_cadence_spm") is not None else None
        ),
        actual_stride_m=(
            float(r["actual_stride_m"]) if r.get("actual_stride_m") is not None else None
        ),
        actual_power_w=(int(r["actual_power_w"]) if r.get("actual_power_w") is not None else None),
        actual_training_load=(
            float(r["actual_training_load"]) if r.get("actual_training_load") is not None else None
        ),
        actual_aerobic_te=(
            float(r["actual_aerobic_te"]) if r.get("actual_aerobic_te") is not None else None
        ),
        actual_anaerobic_te=(
            float(r["actual_anaerobic_te"]) if r.get("actual_anaerobic_te") is not None else None
        ),
        actual_calories=(
            int(r["actual_calories"]) if r.get("actual_calories") is not None else None
        ),
        rpe=int(r["rpe"]) if r.get("rpe") is not None else None,
        notes=r.get("notes"),
        garmin_workout_id=(
            int(r["garmin_workout_id"]) if r.get("garmin_workout_id") is not None else None
        ),
        garmin_schedule_id=(
            int(r["garmin_schedule_id"]) if r.get("garmin_schedule_id") is not None else None
        ),
        status=r["status"],
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
        stamm_rows = get_stammdaten(conn)

    stamm_items = [
        StammdatenItem(
            category=str(r["category"]),
            parameter=str(r["parameter"]),
            value=str(r["value"]),
            unit_or_range=r.get("unit_or_range"),
            reference_note=r.get("reference_note"),
        )
        for r in stamm_rows
    ]

    if plan_row is None:
        return TrainingPlanResponse(has_active_plan=False, days=[], stammdaten=stamm_items)

    days = [_row_to_plan_day_item(r) for r in day_rows]

    return TrainingPlanResponse(
        has_active_plan=True,
        plan_id=int(plan_row["id"]),
        name=str(plan_row["name"]),
        start_date=str(plan_row["start_date"]),
        end_date=str(plan_row["end_date"]),
        notes=plan_row.get("notes"),
        updated_at=str(plan_row["updated_at"]),
        days=days,
        stammdaten=stamm_items,
    )


@router.patch("/plan/days/{day_date}/notes", response_model=PlanDayItem)
async def patch_plan_day_notes(
    request: Request,
    day_date: date,
    body: PlanDayNotesUpdateRequest,
) -> PlanDayItem:
    """Save and overwrite the notes for a single plan day."""
    settings: Settings = request.app.state.settings
    updated = await asyncio.to_thread(
        update_plan_day_notes,
        settings,
        day_date.isoformat(),
        body.notes,
    )
    if updated is None:
        raise HTTPException(
            status_code=404,
            detail=f"Plan day '{day_date.isoformat()}' not found in active plan",
        )
    return _row_to_plan_day_item(updated)


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
