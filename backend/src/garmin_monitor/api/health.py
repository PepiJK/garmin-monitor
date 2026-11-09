"""Health telemetry and warnings REST endpoint (/api/health/dashboard)."""

import json
from typing import Annotated, Any

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

from garmin_monitor.config import Settings
from garmin_monitor.db import RowDict, connect_db, get_latest_sync_run, init_db
from garmin_monitor.sync_service import select_morning_training_readiness
from garmin_monitor.warnings import (
    HealthWarning,
    compute_rolling_hrv_bounds,
    compute_rolling_resting_hr_mean,
    evaluate_health_warnings,
)

router = APIRouter(prefix="/api/health", tags=["health"])


class HealthKpiSummary(BaseModel):
    """Current vitals KPI summary cards on the /health dashboard."""

    hrv_nightly_avg: float | None = None
    hrv_weekly_avg: float | None = None
    hrv_baseline_low: float | None = None
    hrv_baseline_high: float | None = None
    hrv_status: str | None = None
    sleep_score: int | None = None
    sleep_qualifier: str | None = None
    sleep_total_min: float | None = None
    resting_hr: int | None = None
    resting_hr_30d_mean: float | None = None
    body_battery_high: int | None = None
    body_battery_low: int | None = None
    body_battery_charged: int | None = None
    body_battery_drained: int | None = None
    stress_avg: int | None = None
    training_readiness_score: int | None = None
    training_readiness_level: str | None = None
    acute_load: int | None = None
    recovery_time_hours: float | None = None
    acwr_status: str | None = None
    acwr_percent: int | None = None
    readiness_feedback: str | None = None
    intensity_minutes: int | None = None
    intensity_minutes_goal: int | None = None
    spo2_avg: float | None = None
    respiration_avg: float | None = None
    steps: int | None = None


class DailyHealthPoint(BaseModel):
    """Single day of physiological recovery metrics for ECharts trend diagrams."""

    date: str
    sleep_score: int | None = None
    sleep_qualifier: str | None = None
    sleep_total_min: float | None = None
    sleep_deep_min: float | None = None
    sleep_light_min: float | None = None
    sleep_rem_min: float | None = None
    sleep_awake_min: float | None = None
    hrv_nightly_avg: float | None = None
    hrv_weekly_avg: float | None = None
    hrv_baseline_low: float | None = None
    hrv_baseline_high: float | None = None
    hrv_status: str | None = None
    resting_hr: int | None = None
    min_hr: int | None = None
    max_hr: int | None = None
    stress_avg: int | None = None
    stress_max: int | None = None
    body_battery_high: int | None = None
    body_battery_low: int | None = None
    body_battery_charged: int | None = None
    body_battery_drained: int | None = None
    spo2_avg: float | None = None
    respiration_avg: float | None = None
    steps: int | None = None
    training_readiness_score: int | None = None
    training_readiness_level: str | None = None
    acute_load: int | None = None
    recovery_time_hours: float | None = None
    acwr_status: str | None = None
    acwr_percent: int | None = None
    readiness_feedback: str | None = None
    intensity_minutes: int | None = None
    active_calories: int | None = None


class HealthDashboardResponse(BaseModel):
    """Response payload for GET /api/health/dashboard."""

    days_requested: int
    latest_date: str | None = None
    warnings: list[HealthWarning]
    kpis: HealthKpiSummary
    series: list[DailyHealthPoint]


def _sec_to_min(sec: int | float | None) -> float | None:
    if sec is None:
        return None
    return round(float(sec) / 60.0, 1)


def _opt_int(val: Any) -> int | None:
    if val is None or isinstance(val, bool):
        return None
    try:
        return round(float(val))
    except TypeError, ValueError:
        return None


def _opt_float(val: Any) -> float | None:
    if val is None or isinstance(val, bool):
        return None
    try:
        return float(val)
    except TypeError, ValueError:
        return None


@router.get("/dashboard", response_model=HealthDashboardResponse)
async def get_health_dashboard(
    request: Request,
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> HealthDashboardResponse:
    """Return severity-ranked health warnings, current vitals KPIs, and historical series."""
    settings: Settings = request.app.state.settings
    init_db(settings.database_path)
    fetch_limit = max(days, 35)

    with connect_db(settings.database_path) as conn:
        raw_rows = conn.execute(
            "SELECT * FROM daily_health ORDER BY date DESC LIMIT ?",
            (fetch_limit,),
        ).fetchall()
        latest_sync = get_latest_sync_run(conn)

    chronological: list[RowDict] = [dict(r) for r in reversed(raw_rows)]
    warnings = evaluate_health_warnings(chronological, latest_sync)
    window_rows = chronological[-days:] if chronological else []

    fallback_low, fallback_high = compute_rolling_hrv_bounds(chronological)
    rhr_mean = compute_rolling_resting_hr_mean(chronological)

    series: list[DailyHealthPoint] = []
    latest_im_goal: int | None = None
    for r in window_rows:
        b_low = (
            float(r["hrv_baseline_low"]) if r.get("hrv_baseline_low") is not None else fallback_low
        )
        b_high = (
            float(r["hrv_baseline_high"])
            if r.get("hrv_baseline_high") is not None
            else fallback_high
        )
        raw_bundle: dict[str, Any] = {}
        raw_json_str = r.get("raw_json")
        if isinstance(raw_json_str, str) and raw_json_str.strip():
            try:
                parsed = json.loads(raw_json_str)
                if isinstance(parsed, dict):
                    raw_bundle = parsed
            except ValueError:
                pass

        tr_morning = select_morning_training_readiness(raw_bundle.get("training_readiness"))
        tr_score = _opt_int(tr_morning.get("score"))
        if tr_score is None:
            tr_score = _opt_int(r.get("training_readiness_score"))
        tr_level = (
            str(tr_morning["level"])
            if tr_morning.get("level")
            else (str(r["training_readiness_level"]) if r.get("training_readiness_level") else None)
        )
        acute_load = _opt_int(tr_morning.get("acuteLoad"))
        rec_min = _opt_float(tr_morning.get("recoveryTime"))
        recovery_time_hours = round(rec_min / 60.0, 1) if rec_min is not None else None
        acwr_status = (
            str(tr_morning["acwrFactorFeedback"]) if tr_morning.get("acwrFactorFeedback") else None
        )
        acwr_percent = _opt_int(tr_morning.get("acwrFactorPercent"))
        readiness_feedback = (
            str(tr_morning["feedbackShort"]) if tr_morning.get("feedbackShort") else None
        )

        user_summary = (
            raw_bundle.get("user_summary")
            if isinstance(raw_bundle.get("user_summary"), dict)
            else {}
        )
        bb_charged = _opt_int(user_summary.get("bodyBatteryChargedValue"))
        bb_drained = _opt_int(user_summary.get("bodyBatteryDrainedValue"))
        mod_min = _opt_int(user_summary.get("moderateIntensityMinutes"))
        vig_min = _opt_int(user_summary.get("vigorousIntensityMinutes"))
        intensity_minutes = (
            (mod_min or 0) + 2 * (vig_min or 0)
            if (mod_min is not None or vig_min is not None)
            else None
        )
        im_goal = _opt_int(user_summary.get("intensityMinutesGoal"))
        if im_goal is not None:
            latest_im_goal = im_goal
        active_calories = _opt_int(user_summary.get("activeKilocalories"))

        series.append(
            DailyHealthPoint(
                date=str(r["date"]),
                sleep_score=r.get("sleep_score"),
                sleep_qualifier=r.get("sleep_qualifier"),
                sleep_total_min=_sec_to_min(r.get("sleep_total_sec")),
                sleep_deep_min=_sec_to_min(r.get("sleep_deep_sec")),
                sleep_light_min=_sec_to_min(r.get("sleep_light_sec")),
                sleep_rem_min=_sec_to_min(r.get("sleep_rem_sec")),
                sleep_awake_min=_sec_to_min(r.get("sleep_awake_sec")),
                hrv_nightly_avg=r.get("hrv_nightly_avg"),
                hrv_weekly_avg=r.get("hrv_weekly_avg"),
                hrv_baseline_low=b_low,
                hrv_baseline_high=b_high,
                hrv_status=r.get("hrv_status"),
                resting_hr=r.get("resting_hr"),
                min_hr=r.get("min_hr"),
                max_hr=r.get("max_hr"),
                stress_avg=r.get("stress_avg"),
                stress_max=r.get("stress_max"),
                body_battery_high=r.get("body_battery_high"),
                body_battery_low=r.get("body_battery_low"),
                body_battery_charged=bb_charged,
                body_battery_drained=bb_drained,
                spo2_avg=r.get("spo2_avg"),
                respiration_avg=r.get("respiration_avg"),
                steps=r.get("steps"),
                training_readiness_score=tr_score,
                training_readiness_level=tr_level,
                acute_load=acute_load,
                recovery_time_hours=recovery_time_hours,
                acwr_status=acwr_status,
                acwr_percent=acwr_percent,
                readiness_feedback=readiness_feedback,
                intensity_minutes=intensity_minutes,
                active_calories=active_calories,
            )
        )

    if not series:
        return HealthDashboardResponse(
            days_requested=days,
            latest_date=None,
            warnings=warnings,
            kpis=HealthKpiSummary(),
            series=[],
        )

    latest_pt = series[-1]
    kpis = HealthKpiSummary(
        hrv_nightly_avg=latest_pt.hrv_nightly_avg,
        hrv_weekly_avg=latest_pt.hrv_weekly_avg,
        hrv_baseline_low=latest_pt.hrv_baseline_low,
        hrv_baseline_high=latest_pt.hrv_baseline_high,
        hrv_status=latest_pt.hrv_status,
        sleep_score=latest_pt.sleep_score,
        sleep_qualifier=latest_pt.sleep_qualifier,
        sleep_total_min=latest_pt.sleep_total_min,
        resting_hr=latest_pt.resting_hr,
        resting_hr_30d_mean=rhr_mean,
        body_battery_high=latest_pt.body_battery_high,
        body_battery_low=latest_pt.body_battery_low,
        body_battery_charged=latest_pt.body_battery_charged,
        body_battery_drained=latest_pt.body_battery_drained,
        stress_avg=latest_pt.stress_avg,
        training_readiness_score=latest_pt.training_readiness_score,
        training_readiness_level=latest_pt.training_readiness_level,
        acute_load=latest_pt.acute_load,
        recovery_time_hours=latest_pt.recovery_time_hours,
        acwr_status=latest_pt.acwr_status,
        acwr_percent=latest_pt.acwr_percent,
        readiness_feedback=latest_pt.readiness_feedback,
        intensity_minutes=latest_pt.intensity_minutes,
        intensity_minutes_goal=latest_im_goal,
        spo2_avg=latest_pt.spo2_avg,
        respiration_avg=latest_pt.respiration_avg,
        steps=latest_pt.steps,
    )

    return HealthDashboardResponse(
        days_requested=days,
        latest_date=latest_pt.date,
        warnings=warnings,
        kpis=kpis,
        series=series,
    )
