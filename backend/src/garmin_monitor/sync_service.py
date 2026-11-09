"""Synchronization service for Garmin Connect activities and daily health records."""

import json
import logging
import sqlite3
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict

from garmin_monitor.config import Settings
from garmin_monitor.db import (
    connect_db,
    finish_sync_run,
    init_db,
    is_database_empty,
    start_sync_run,
)
from garmin_monitor.garmin_client import GarminClient, JsonDict
from garmin_monitor.plan_service import reconcile_plan_completions, sync_future_plan_conn

logger = logging.getLogger(__name__)

type PostSyncHook = Callable[[sqlite3.Connection, date], None]

RUNNING_SPORT_KEYS: frozenset[str] = frozenset(
    {
        "running",
        "street_running",
        "trail_running",
        "treadmill_running",
        "track_running",
        "indoor_running",
        "ultra_run",
        "virtual_run",
    }
)
STRENGTH_SPORT_KEYS: frozenset[str] = frozenset(
    {
        "strength_training",
        "fitness_equipment",
        "indoor_cardio",
        "hiit",
    }
)


class ActivityRecord(BaseModel):
    """Normalized activity row stored in the SQLite activities table."""

    model_config = ConfigDict(extra="ignore")

    activity_id: int
    activity_name: str
    sport_type: str
    start_time_local: str
    date_local: str
    duration_sec: float = 0.0
    distance_m: float = 0.0
    avg_hr: int | None = None
    max_hr: int | None = None
    avg_speed_mps: float | None = None
    calories: int | None = None
    elevation_gain_m: float | None = None
    aerobic_te: float | None = None
    anaerobic_te: float | None = None
    training_load: float | None = None
    associated_workout_id: int | None = None
    raw_json: str
    synced_at: str


class DailyHealthRecord(BaseModel):
    """Normalized daily health row stored in the SQLite daily_health table."""

    model_config = ConfigDict(extra="ignore")

    date: str
    sleep_score: int | None = None
    sleep_qualifier: str | None = None
    sleep_total_sec: int | None = None
    sleep_deep_sec: int | None = None
    sleep_light_sec: int | None = None
    sleep_rem_sec: int | None = None
    sleep_awake_sec: int | None = None
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
    spo2_avg: float | None = None
    spo2_low: float | None = None
    respiration_avg: float | None = None
    steps: int | None = None
    training_readiness_score: int | None = None
    training_readiness_level: str | None = None
    raw_json: str
    synced_at: str


class SyncResult(BaseModel):
    """Summary returned after executing a synchronization run."""

    run_id: int
    days_synced: int
    activities_synced: int
    health_days_synced: int
    planned_workouts_synced: int = 0
    start_date: str
    end_date: str


def normalize_sport_type(raw_sport_key: str | None) -> str:
    """Normalize Garmin activityType.typeKey into canonical sport categories."""
    if not raw_sport_key:
        return "other"
    lowered = raw_sport_key.strip().lower()
    if lowered in RUNNING_SPORT_KEYS:
        return "running"
    if lowered in STRENGTH_SPORT_KEYS:
        return "strength_training"
    return lowered


def normalize_timestamp_to_tz(
    raw_gmt: str | None,
    raw_local: str | None,
    tz: ZoneInfo,
) -> tuple[str, str]:
    """Normalize a Garmin activity timestamp to the configured local timezone (Europe/Vienna)."""
    if raw_gmt:
        cleaned = raw_gmt.strip().replace(" ", "T")
        if cleaned.endswith("Z"):
            cleaned = f"{cleaned[:-1]}+00:00"
        elif "+" not in cleaned[10:] and "-" not in cleaned[10:]:
            cleaned = f"{cleaned}+00:00"
        try:
            dt_utc = datetime.fromisoformat(cleaned)
            dt_local = dt_utc.astimezone(tz)
            return dt_local.isoformat(), dt_local.date().isoformat()
        except ValueError:
            pass

    if raw_local:
        cleaned_local = raw_local.strip().replace(" ", "T")
        try:
            dt_parsed = datetime.fromisoformat(cleaned_local)
            if dt_parsed.tzinfo is None:
                dt_parsed = dt_parsed.replace(tzinfo=tz)
            else:
                dt_parsed = dt_parsed.astimezone(tz)
            return dt_parsed.isoformat(), dt_parsed.date().isoformat()
        except ValueError:
            if len(cleaned_local) >= 10:
                return cleaned_local, cleaned_local[:10]

    now_local = datetime.now(tz)
    return now_local.isoformat(), now_local.date().isoformat()


def _to_int(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return round(float(value))
    except TypeError, ValueError:
        return None


def _to_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except TypeError, ValueError:
        return None


def select_morning_training_readiness(tr_raw: Any) -> JsonDict:
    """Select the morning (AFTER_WAKEUP_RESET) Training Readiness snapshot when available."""
    if isinstance(tr_raw, list) and tr_raw:
        dict_entries = [e for e in tr_raw if isinstance(e, dict)]
        return next(
            (e for e in dict_entries if e.get("inputContext") == "AFTER_WAKEUP_RESET"),
            dict_entries[0] if dict_entries else {},
        )
    if isinstance(tr_raw, dict):
        return tr_raw
    return {}


def parse_activity(raw: JsonDict, tz: ZoneInfo, synced_at: str | None = None) -> ActivityRecord:
    """Convert a raw Garmin Connect activity dictionary into an ActivityRecord."""
    ts_synced = synced_at or datetime.now(UTC).isoformat()
    activity_type = raw.get("activityType")
    raw_type_key = (
        activity_type.get("typeKey")
        if isinstance(activity_type, dict)
        else str(activity_type or "other")
    )
    sport_type = normalize_sport_type(raw_type_key)
    start_time_local, date_local = normalize_timestamp_to_tz(
        raw.get("startTimeGMT"),
        raw.get("startTimeLocal"),
        tz,
    )

    workout_id = raw.get("associatedWorkoutId")
    if workout_id is None and isinstance(raw.get("workoutId"), (int, str)):
        workout_id = raw.get("workoutId")

    return ActivityRecord(
        activity_id=int(raw["activityId"]),
        activity_name=str(raw.get("activityName") or sport_type.replace("_", " ").title()),
        sport_type=sport_type,
        start_time_local=start_time_local,
        date_local=date_local,
        duration_sec=_to_float(raw.get("duration")) or 0.0,
        distance_m=_to_float(raw.get("distance")) or 0.0,
        avg_hr=_to_int(raw.get("averageHR")),
        max_hr=_to_int(raw.get("maxHR")),
        avg_speed_mps=_to_float(raw.get("averageSpeed")),
        calories=_to_int(raw.get("calories")),
        elevation_gain_m=_to_float(raw.get("elevationGain")),
        aerobic_te=_to_float(raw.get("aerobicTrainingEffect")),
        anaerobic_te=_to_float(raw.get("anaerobicTrainingEffect")),
        training_load=_to_float(raw.get("activityTrainingLoad")),
        associated_workout_id=_to_int(workout_id),
        raw_json=json.dumps(raw, sort_keys=True),
        synced_at=ts_synced,
    )


def parse_daily_health(bundle: JsonDict, synced_at: str | None = None) -> DailyHealthRecord:
    """Extract normalized daily physiological metrics from a Garmin daily health bundle."""
    ts_synced = synced_at or datetime.now(UTC).isoformat()
    day_str = str(bundle["date"])

    summary = bundle.get("user_summary") if isinstance(bundle.get("user_summary"), dict) else {}
    sleep_root = bundle.get("sleep") if isinstance(bundle.get("sleep"), dict) else {}
    sleep_dto = (
        sleep_root.get("dailySleepDTO")
        if isinstance(sleep_root.get("dailySleepDTO"), dict)
        else sleep_root
    )
    sleep_scores = (
        sleep_dto.get("sleepScores") if isinstance(sleep_dto.get("sleepScores"), dict) else {}
    )
    overall_sleep = (
        sleep_scores.get("overall") if isinstance(sleep_scores.get("overall"), dict) else {}
    )

    hrv_root = bundle.get("hrv") if isinstance(bundle.get("hrv"), dict) else {}
    hrv_summary = (
        hrv_root.get("hrvSummary") if isinstance(hrv_root.get("hrvSummary"), dict) else hrv_root
    )
    hrv_baseline = (
        hrv_summary.get("baseline") if isinstance(hrv_summary.get("baseline"), dict) else {}
    )

    hr_root = bundle.get("heart_rates") if isinstance(bundle.get("heart_rates"), dict) else {}
    stress_root = bundle.get("stress") if isinstance(bundle.get("stress"), dict) else {}
    spo2_root = bundle.get("spo2") if isinstance(bundle.get("spo2"), dict) else {}
    resp_root = bundle.get("respiration") if isinstance(bundle.get("respiration"), dict) else {}

    bb_raw = bundle.get("body_battery")
    bb_high = _to_int(summary.get("bodyBatteryHighestValue"))
    bb_low = _to_int(summary.get("bodyBatteryLowestValue"))
    if isinstance(bb_raw, list) and bb_raw and isinstance(bb_raw[0], dict):
        bb_entry = bb_raw[0]
        bb_high = bb_high if bb_high is not None else _to_int(bb_entry.get("charged"))
        bb_low = bb_low if bb_low is not None else _to_int(bb_entry.get("drained"))
    elif isinstance(bb_raw, dict):
        bb_high = bb_high if bb_high is not None else _to_int(bb_raw.get("bodyBatteryHighestValue"))
        bb_low = bb_low if bb_low is not None else _to_int(bb_raw.get("bodyBatteryLowestValue"))

    tr_entry = select_morning_training_readiness(bundle.get("training_readiness"))

    return DailyHealthRecord(
        date=day_str,
        sleep_score=_to_int(overall_sleep.get("value") or sleep_dto.get("sleepScore")),
        sleep_qualifier=(
            str(overall_sleep.get("qualifierKey") or sleep_dto.get("sleepQualityTypePK"))
            if (overall_sleep.get("qualifierKey") or sleep_dto.get("sleepQualityTypePK"))
            else None
        ),
        sleep_total_sec=_to_int(sleep_dto.get("sleepTimeSeconds")),
        sleep_deep_sec=_to_int(sleep_dto.get("deepSleepSeconds")),
        sleep_light_sec=_to_int(sleep_dto.get("lightSleepSeconds")),
        sleep_rem_sec=_to_int(sleep_dto.get("remSleepSeconds")),
        sleep_awake_sec=_to_int(sleep_dto.get("awakeSleepSeconds")),
        hrv_nightly_avg=_to_float(hrv_summary.get("lastNightAvg")),
        hrv_weekly_avg=_to_float(hrv_summary.get("weeklyAvg")),
        hrv_baseline_low=_to_float(hrv_baseline.get("balancedLow") or hrv_baseline.get("lowUpper")),
        hrv_baseline_high=_to_float(hrv_baseline.get("balancedUpper")),
        hrv_status=str(hrv_summary.get("status")) if hrv_summary.get("status") else None,
        resting_hr=_to_int(hr_root.get("restingHeartRate") or summary.get("restingHeartRate")),
        min_hr=_to_int(hr_root.get("minHeartRate") or summary.get("minHeartRate")),
        max_hr=_to_int(hr_root.get("maxHeartRate") or summary.get("maxHeartRate")),
        stress_avg=_to_int(stress_root.get("avgStressLevel") or summary.get("averageStressLevel")),
        stress_max=_to_int(stress_root.get("maxStressLevel") or summary.get("maxStressLevel")),
        body_battery_high=bb_high,
        body_battery_low=bb_low,
        spo2_avg=_to_float(spo2_root.get("averageSpO2") or summary.get("averageSpo2")),
        spo2_low=_to_float(spo2_root.get("lowestSpO2") or summary.get("lowestSpo2")),
        respiration_avg=_to_float(
            resp_root.get("avgWakingRespirationValue")
            or resp_root.get("avgSleepRespirationValue")
            or summary.get("avgWakingRespirationValue")
        ),
        steps=_to_int(summary.get("totalSteps")),
        training_readiness_score=_to_int(tr_entry.get("score")),
        training_readiness_level=str(tr_entry.get("level")) if tr_entry.get("level") else None,
        raw_json=json.dumps(bundle, sort_keys=True),
        synced_at=ts_synced,
    )


def upsert_activity(conn: sqlite3.Connection, record: ActivityRecord) -> None:
    """Idempotently insert or update an activity row in SQLite."""
    conn.execute(
        """
        INSERT INTO activities (
            activity_id, activity_name, sport_type, start_time_local, date_local,
            duration_sec, distance_m, avg_hr, max_hr, avg_speed_mps,
            calories, elevation_gain_m, aerobic_te, anaerobic_te, training_load,
            associated_workout_id, raw_json, synced_at
        ) VALUES (
            :activity_id, :activity_name, :sport_type, :start_time_local, :date_local,
            :duration_sec, :distance_m, :avg_hr, :max_hr, :avg_speed_mps,
            :calories, :elevation_gain_m, :aerobic_te, :anaerobic_te, :training_load,
            :associated_workout_id, :raw_json, :synced_at
        )
        ON CONFLICT(activity_id) DO UPDATE SET
            activity_name = excluded.activity_name,
            sport_type = excluded.sport_type,
            start_time_local = excluded.start_time_local,
            date_local = excluded.date_local,
            duration_sec = excluded.duration_sec,
            distance_m = excluded.distance_m,
            avg_hr = excluded.avg_hr,
            max_hr = excluded.max_hr,
            avg_speed_mps = excluded.avg_speed_mps,
            calories = excluded.calories,
            elevation_gain_m = excluded.elevation_gain_m,
            aerobic_te = excluded.aerobic_te,
            anaerobic_te = excluded.anaerobic_te,
            training_load = excluded.training_load,
            associated_workout_id = excluded.associated_workout_id,
            raw_json = excluded.raw_json,
            synced_at = excluded.synced_at
        """,
        record.model_dump(),
    )


def upsert_daily_health(conn: sqlite3.Connection, record: DailyHealthRecord) -> None:
    """Idempotently insert or update a daily_health row in SQLite."""
    conn.execute(
        """
        INSERT INTO daily_health (
            date, sleep_score, sleep_qualifier, sleep_total_sec, sleep_deep_sec,
            sleep_light_sec, sleep_rem_sec, sleep_awake_sec, hrv_nightly_avg,
            hrv_weekly_avg, hrv_baseline_low, hrv_baseline_high, hrv_status,
            resting_hr, min_hr, max_hr, stress_avg, stress_max,
            body_battery_high, body_battery_low, spo2_avg, spo2_low,
            respiration_avg, steps, training_readiness_score, training_readiness_level,
            raw_json, synced_at
        ) VALUES (
            :date, :sleep_score, :sleep_qualifier, :sleep_total_sec, :sleep_deep_sec,
            :sleep_light_sec, :sleep_rem_sec, :sleep_awake_sec, :hrv_nightly_avg,
            :hrv_weekly_avg, :hrv_baseline_low, :hrv_baseline_high, :hrv_status,
            :resting_hr, :min_hr, :max_hr, :stress_avg, :stress_max,
            :body_battery_high, :body_battery_low, :spo2_avg, :spo2_low,
            :respiration_avg, :steps, :training_readiness_score, :training_readiness_level,
            :raw_json, :synced_at
        )
        ON CONFLICT(date) DO UPDATE SET
            sleep_score = excluded.sleep_score,
            sleep_qualifier = excluded.sleep_qualifier,
            sleep_total_sec = excluded.sleep_total_sec,
            sleep_deep_sec = excluded.sleep_deep_sec,
            sleep_light_sec = excluded.sleep_light_sec,
            sleep_rem_sec = excluded.sleep_rem_sec,
            sleep_awake_sec = excluded.sleep_awake_sec,
            hrv_nightly_avg = excluded.hrv_nightly_avg,
            hrv_weekly_avg = excluded.hrv_weekly_avg,
            hrv_baseline_low = excluded.hrv_baseline_low,
            hrv_baseline_high = excluded.hrv_baseline_high,
            hrv_status = excluded.hrv_status,
            resting_hr = excluded.resting_hr,
            min_hr = excluded.min_hr,
            max_hr = excluded.max_hr,
            stress_avg = excluded.stress_avg,
            stress_max = excluded.stress_max,
            body_battery_high = excluded.body_battery_high,
            body_battery_low = excluded.body_battery_low,
            spo2_avg = excluded.spo2_avg,
            spo2_low = excluded.spo2_low,
            respiration_avg = excluded.respiration_avg,
            steps = excluded.steps,
            training_readiness_score = excluded.training_readiness_score,
            training_readiness_level = excluded.training_readiness_level,
            raw_json = excluded.raw_json,
            synced_at = excluded.synced_at
        """,
        record.model_dump(),
    )


class SyncService:
    """Orchestrates downloading Garmin Connect data and persisting to SQLite."""

    def __init__(
        self,
        settings: Settings,
        client: GarminClient | None = None,
        post_sync_hook: PostSyncHook | None = None,
    ) -> None:
        self.settings = settings
        self.client = client or GarminClient(settings.garmin_token_dir)
        self.post_sync_hook = post_sync_hook or (
            lambda conn, today: reconcile_plan_completions(conn, today)
        )

    def sync(
        self,
        *,
        days: int | None = None,
        reference_date: date | None = None,
    ) -> SyncResult:
        """Download activities and daily health metrics, upserting into SQLite."""
        init_db(self.settings.database_path)
        tz = self.settings.timezone
        today_local = reference_date or datetime.now(tz).date()

        with connect_db(self.settings.database_path) as conn:
            effective_days = (
                days
                if days is not None
                else (self.settings.sync_backfill_days if is_database_empty(conn) else 2)
            )
            effective_days = max(1, effective_days)
            start_date = today_local - timedelta(days=effective_days - 1)
            run_id = start_sync_run(conn, effective_days)

            try:
                self.client.load_session()
                raw_activities = self.client.fetch_activities_by_date(start_date, today_local)
                synced_at = datetime.now(UTC).isoformat()

                activities_count = 0
                for raw_act in raw_activities:
                    if "activityId" not in raw_act:
                        continue
                    if "directWorkoutRpe" not in raw_act and hasattr(
                        self.client, "fetch_activity_detail"
                    ):
                        detail = self.client.fetch_activity_detail(raw_act["activityId"])
                        if isinstance(detail, dict):
                            summary_dto = (
                                detail.get("summaryDTO")
                                if isinstance(detail.get("summaryDTO"), dict)
                                else {}
                            )
                            metadata_dto = (
                                detail.get("metadataDTO")
                                if isinstance(detail.get("metadataDTO"), dict)
                                else {}
                            )
                            if summary_dto.get("directWorkoutRpe") is not None:
                                raw_act["directWorkoutRpe"] = summary_dto["directWorkoutRpe"]
                            if summary_dto.get("directWorkoutFeel") is not None:
                                raw_act["directWorkoutFeel"] = summary_dto["directWorkoutFeel"]
                            if (
                                raw_act.get("associatedWorkoutId") is None
                                and metadata_dto.get("associatedWorkoutId") is not None
                            ):
                                raw_act["associatedWorkoutId"] = metadata_dto["associatedWorkoutId"]
                    act_record = parse_activity(raw_act, tz, synced_at=synced_at)
                    upsert_activity(conn, act_record)
                    activities_count += 1

                health_count = 0
                for offset in range(effective_days):
                    day = start_date + timedelta(days=offset)
                    bundle = self.client.fetch_daily_health_bundle(day)
                    health_record = parse_daily_health(bundle, synced_at=synced_at)
                    upsert_daily_health(conn, health_record)
                    health_count += 1

                if self.post_sync_hook is not None:
                    self.post_sync_hook(conn, today_local)

                planned_synced = 0
                if hasattr(self.client, "upload_workout"):
                    try:
                        planned_synced = sync_future_plan_conn(
                            conn,
                            self.client,
                            today_local,
                            force=False,
                        )
                    except Exception as plan_exc:
                        logger.warning(f"Future plan workout sync skipped: {plan_exc}")

                finish_sync_run(
                    conn,
                    run_id,
                    status="success",
                    activities_synced=activities_count,
                    health_days_synced=health_count,
                )
                return SyncResult(
                    run_id=run_id,
                    days_synced=effective_days,
                    activities_synced=activities_count,
                    health_days_synced=health_count,
                    planned_workouts_synced=planned_synced,
                    start_date=start_date.isoformat(),
                    end_date=today_local.isoformat(),
                )
            except Exception as exc:
                finish_sync_run(
                    conn,
                    run_id,
                    status="error",
                    error_message=str(exc),
                )
                raise
