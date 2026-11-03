"""Health problem warning evaluator combining Garmin native statuses and 30-day baselines."""

from datetime import UTC, datetime
from statistics import mean, pstdev
from typing import Literal

from pydantic import BaseModel

from garmin_monitor.db import RowDict

type WarningSeverity = Literal["critical", "warning"]
type WarningCode = Literal[
    "sync_stale",
    "sync_failed",
    "hrv_status",
    "hrv_below_baseline",
    "sleep_consecutive_low",
    "sleep_poor",
    "resting_hr_elevated",
    "body_battery_low",
]

STALE_SYNC_THRESHOLD_HOURS: float = 6.0


class HealthWarning(BaseModel):
    """Actionable health or synchronization warning surfaced on the /health dashboard."""

    code: WarningCode
    severity: WarningSeverity
    title: str
    metric: str
    observed_value: str
    baseline_or_threshold: str
    description: str
    date: str | None = None


def _parse_iso_utc(raw_ts: str | None) -> datetime | None:
    if not raw_ts:
        return None
    cleaned = raw_ts.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(cleaned)
        return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)
    except ValueError:
        return None


def compute_rolling_hrv_bounds(health_rows: list[RowDict]) -> tuple[float | None, float | None]:
    """Compute personal 30-day HRV baseline bounds when Garmin baseline bounds are absent."""
    recent_rows = health_rows[-30:]
    values = [
        float(r["hrv_nightly_avg"]) for r in recent_rows if r.get("hrv_nightly_avg") is not None
    ]
    if not values:
        return None, None
    avg = mean(values)
    sd = pstdev(values) if len(values) >= 3 else avg * 0.10
    spread = max(sd, avg * 0.08)
    return round(avg - spread, 1), round(avg + spread, 1)


def compute_rolling_resting_hr_mean(health_rows: list[RowDict]) -> float | None:
    """Compute the 30-day rolling mean for resting heart rate."""
    recent_rows = health_rows[-30:]
    values = [float(r["resting_hr"]) for r in recent_rows if r.get("resting_hr") is not None]
    return round(mean(values), 1) if values else None


def evaluate_health_warnings(
    health_rows: list[RowDict],
    latest_sync: RowDict | None,
    *,
    now_utc: datetime | None = None,
) -> list[HealthWarning]:
    """Evaluate all physiological and sync rules, returning severity-ranked warnings."""
    current_utc = now_utc or datetime.now(UTC)
    warnings: list[HealthWarning] = []

    # 1. Sync staleness or failure (> 6 hours)
    if latest_sync is None:
        warnings.append(
            HealthWarning(
                code="sync_stale",
                severity="critical",
                title="No Garmin synchronization recorded",
                metric="Sync Status",
                observed_value="Never synced",
                baseline_or_threshold=f"<= {STALE_SYNC_THRESHOLD_HOURS:.0f}h interval",
                description="Trigger a manual sync or verify Garmin session tokens on the server.",
            )
        )
    else:
        sync_status = str(latest_sync.get("status") or "")
        sync_ts = _parse_iso_utc(latest_sync.get("finished_at") or latest_sync.get("started_at"))
        if sync_status == "error":
            err_msg = str(latest_sync.get("error_message") or "Unknown sync error")
            warnings.append(
                HealthWarning(
                    code="sync_failed",
                    severity="critical",
                    title="Garmin Connect synchronization failed",
                    metric="Sync Status",
                    observed_value="Error",
                    baseline_or_threshold="Healthy 2h sync",
                    description=f"Last sync attempt failed: {err_msg}",
                )
            )
        elif sync_ts is not None:
            age_hours = (current_utc - sync_ts).total_seconds() / 3600.0
            if age_hours > STALE_SYNC_THRESHOLD_HOURS:
                warnings.append(
                    HealthWarning(
                        code="sync_stale",
                        severity="critical",
                        title="Garmin telemetry is stale",
                        metric="Sync Age",
                        observed_value=f"{age_hours:.1f} hours ago",
                        baseline_or_threshold=f"<= {STALE_SYNC_THRESHOLD_HOURS:.0f} hours",
                        description=(
                            "Data has not synced within the last 6 hours. "
                            "Sync your Fenix 7S with Garmin Connect Mobile or click Sync now."
                        ),
                    )
                )

    if not health_rows:
        return warnings

    sorted_rows = sorted(health_rows, key=lambda r: str(r["date"]))
    latest = sorted_rows[-1]
    latest_date = str(latest["date"])

    # 2. Garmin native HRV status
    hrv_status = str(latest.get("hrv_status") or "").upper()
    hrv_nightly = (
        float(latest["hrv_nightly_avg"]) if latest.get("hrv_nightly_avg") is not None else None
    )
    if hrv_status in {"POOR", "LOW"}:
        obs_hrv = f"{hrv_status} ({hrv_nightly:.0f} ms)" if hrv_nightly is not None else hrv_status
        warnings.append(
            HealthWarning(
                code="hrv_status",
                severity="critical",
                title=f"Garmin HRV status is {hrv_status}",
                metric="HRV Status",
                observed_value=obs_hrv,
                baseline_or_threshold="BALANCED",
                description=(
                    "Autonomic recovery is significantly suppressed. "
                    "Prioritize sleep and consider replacing high-intensity sessions with rest."
                ),
                date=latest_date,
            )
        )
    elif hrv_status == "UNBALANCED":
        warnings.append(
            HealthWarning(
                code="hrv_status",
                severity="warning",
                title="Garmin HRV status is UNBALANCED",
                metric="HRV Status",
                observed_value=(
                    f"UNBALANCED ({hrv_nightly:.0f} ms)"
                    if hrv_nightly is not None
                    else "UNBALANCED"
                ),
                baseline_or_threshold="BALANCED",
                description="Weekly HRV trend has drifted outside your balanced recovery corridor.",
                date=latest_date,
            )
        )

    # 3. Nightly HRV below personal baseline range
    fallback_low, fallback_high = compute_rolling_hrv_bounds(sorted_rows[:-1] or sorted_rows)
    baseline_low = (
        float(latest["hrv_baseline_low"])
        if latest.get("hrv_baseline_low") is not None
        else fallback_low
    )
    baseline_high = (
        float(latest["hrv_baseline_high"])
        if latest.get("hrv_baseline_high") is not None
        else fallback_high
    )
    if hrv_nightly is not None and baseline_low is not None and hrv_nightly < baseline_low:
        sev: WarningSeverity = "critical" if hrv_nightly < (baseline_low * 0.85) else "warning"
        band_str = (
            f"{baseline_low:.0f}-{baseline_high:.0f} ms"
            if baseline_high is not None
            else f">= {baseline_low:.0f} ms"
        )
        warnings.append(
            HealthWarning(
                code="hrv_below_baseline",
                severity=sev,
                title="Nightly HRV dropped below personal baseline",
                metric="Nightly HRV",
                observed_value=f"{hrv_nightly:.0f} ms",
                baseline_or_threshold=band_str,
                description=(
                    f"Last night's average HRV ({hrv_nightly:.0f} ms) is below your "
                    f"personal baseline corridor ({band_str})."
                ),
                date=latest_date,
            )
        )

    # 4. Sleep Score < 60 for >= 2 consecutive days or POOR sleep qualifier
    consecutive_low_sleep: list[RowDict] = []
    for row in reversed(sorted_rows):
        score = row.get("sleep_score")
        if score is not None and int(score) < 60:
            consecutive_low_sleep.append(row)
        else:
            break

    sleep_qualifier = str(latest.get("sleep_qualifier") or "").upper()
    latest_sleep_score = (
        int(latest["sleep_score"]) if latest.get("sleep_score") is not None else None
    )
    if len(consecutive_low_sleep) >= 2:
        scores_str = ", ".join(str(r["sleep_score"]) for r in reversed(consecutive_low_sleep))
        streak_len = len(consecutive_low_sleep)
        warnings.append(
            HealthWarning(
                code="sleep_consecutive_low",
                severity="critical",
                title=f"Sleep score below 60 for {streak_len} consecutive nights",
                metric="Sleep Score",
                observed_value=f"{latest_sleep_score} ({streak_len}d streak: {scores_str})",
                baseline_or_threshold=">= 60",
                description=(
                    "Multi-night restorative sleep deficit detected. "
                    "Cumulative fatigue increases injury and overreaching risk."
                ),
                date=latest_date,
            )
        )
    elif sleep_qualifier == "POOR" or (latest_sleep_score is not None and latest_sleep_score < 60):
        obs = (
            f"Score {latest_sleep_score} ({sleep_qualifier})"
            if latest_sleep_score is not None and sleep_qualifier
            else (
                f"Score {latest_sleep_score}" if latest_sleep_score is not None else sleep_qualifier
            )
        )
        warnings.append(
            HealthWarning(
                code="sleep_poor",
                severity="warning",
                title="Poor single-night sleep quality",
                metric="Sleep Quality",
                observed_value=obs,
                baseline_or_threshold=">= 60 / FAIR+",
                description=(
                    "Last night's sleep was non-restorative; monitor effort during today's session."
                ),
                date=latest_date,
            )
        )

    # 5. Resting HR >= +5 bpm above 30-day rolling mean
    rhr_mean = compute_rolling_resting_hr_mean(sorted_rows[:-1] or sorted_rows)
    latest_rhr = int(latest["resting_hr"]) if latest.get("resting_hr") is not None else None
    if latest_rhr is not None and rhr_mean is not None:
        delta = latest_rhr - rhr_mean
        if delta >= 5.0:
            rhr_sev: WarningSeverity = "critical" if delta >= 8.0 else "warning"
            warnings.append(
                HealthWarning(
                    code="resting_hr_elevated",
                    severity=rhr_sev,
                    title=f"Resting heart rate elevated (+{delta:.1f} bpm)",
                    metric="Resting HR",
                    observed_value=f"{latest_rhr} bpm",
                    baseline_or_threshold=f"30d mean {rhr_mean:.1f} bpm (+5 bpm limit)",
                    description=(
                        f"Resting HR is {delta:.1f} bpm above your 30-day rolling average "
                        f"({rhr_mean:.1f} bpm), indicating systemic stress or incomplete recovery."
                    ),
                    date=latest_date,
                )
            )

    # 6. Morning Body Battery high < 50
    bb_high = (
        int(latest["body_battery_high"]) if latest.get("body_battery_high") is not None else None
    )
    if bb_high is not None and bb_high < 50:
        bb_sev: WarningSeverity = "critical" if bb_high < 35 else "warning"
        warnings.append(
            HealthWarning(
                code="body_battery_low",
                severity=bb_sev,
                title="Low morning Body Battery recharge",
                metric="Body Battery High",
                observed_value=f"{bb_high} / 100",
                baseline_or_threshold=">= 50",
                description=(
                    f"Peak Body Battery only reached {bb_high} today, "
                    "below the 50 minimum readiness threshold."
                ),
                date=latest_date,
            )
        )

    warnings.sort(key=lambda w: 0 if w.severity == "critical" else 1)
    return warnings
