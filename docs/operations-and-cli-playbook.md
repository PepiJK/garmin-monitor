# Server AI & Developer Operational Playbook (`pepnet.at`)

This document guides AI coding/coaching agents and operators managing **Garmin Monitor** (`https://garmin.pepnet.at`) both from a developer workstation via read-only SSH and directly on the `pepnet.at` server (`/opt/pepnet/garmin-monitor`).

---

## 1. Infrastructure & Read-Only SSH Inspection (`pepnet.at`)

- **Host**: `pepnet.at` (`2.31.123.162`, `x86_64` Linux)
- **Read-Only SSH Access**:
  - From the workstation, inspect production state via `ssh josef@pepnet.at`:
    - Reverse proxy stack: `/opt/pepnet/docker-compose.yml` and `/opt/pepnet/caddy/Caddyfile` (`caddy:2-alpine` v2.11.7 attached to Docker network `pepnet_web_net`).
    - Garmin Monitor stack: `/opt/pepnet/garmin-monitor/docker-compose.yml` (`container_name: garmin-monitor`, `mem_limit: 384m`, bind-mounting `/opt/pepnet/garmin-monitor/data:/data`).
- **Quick Server Diagnostics**:
  ```bash
  ssh josef@pepnet.at "docker ps && docker logs --tail 50 garmin-monitor"
  ```

---

## 2. Inspecting Training & Physiological Data on `pepnet.at`

Inside `/opt/pepnet/garmin-monitor`, the SQLite database (WAL mode) resides at `/opt/pepnet/garmin-monitor/data/garmin.db` (`/data/garmin.db` inside the `garmin-monitor` container).

### 2.1 View Active Training Plan & Stammdaten Summaries
```bash
docker exec garmin-monitor python -m garmin_monitor plan summary
docker exec garmin-monitor python -m garmin_monitor stammdaten summary
```

### 2.2 Export Current Active Plan & Stammdaten to YAML
```bash
docker exec garmin-monitor python -m garmin_monitor plan export > current_plan.yaml
docker exec garmin-monitor python -m garmin_monitor stammdaten export > stammdaten.yaml
```

### 2.3 Query Recent Activities & Recovery Metrics Directly via SQLite
```bash
# Last 14 days of completed activities
sqlite3 -header -column /opt/pepnet/garmin-monitor/data/garmin.db "
  SELECT date_local, sport_type, activity_name,
         ROUND(distance_m / 1000.0, 2) AS km,
         ROUND(duration_sec / 60.0, 1) AS min,
         avg_hr, max_hr, training_load
  FROM activities
  ORDER BY start_time_local DESC
  LIMIT 20;
"

# Last 14 days of HRV, Sleep, Resting HR, and Readiness
sqlite3 -header -column /opt/pepnet/garmin-monitor/data/garmin.db "
  SELECT date, sleep_score, sleep_qualifier,
         hrv_nightly_avg, hrv_baseline_low, hrv_status,
         resting_hr, body_battery_high, training_readiness_score
  FROM daily_health
  ORDER BY date DESC
  LIMIT 14;
"
```

---

## 3. Authoring & Applying Training Plans (`plan apply`) & Stammdaten (`stammdaten apply`)

Structural mutations to the training plan and athlete master data (`Stammdaten`) are performed via the server CLI (`plan apply <file.yaml|json>` and `stammdaten apply <file.yaml|json>`). Inline day notes can also be edited in the `/training` -> `Plan` web table (`PATCH /api/training/plan/days/{day_date}/notes`).

### 3.1 How `plan apply` Works
1. **Validates** the YAML/JSON file against `TrainingPlanSpec` (Pydantic v2).
2. **Applies Optional Stammdaten**: If the plan file contains a top-level `stammdaten` list, replaces the stored `stammdaten` rows in SQLite.
3. **Preserves Completed History**: Any existing `plan_days` row with `date < today` (`Europe/Vienna`) and `status` in `('done', 'partial')` is preserved untouched (including user-entered `notes` and reconciled actual metrics) so completed execution telemetry is never lost.
4. **Cleans Up Superseded Future Workouts**: Any existing future (`date >= today`) workout with a `garmin_schedule_id` or `garmin_workout_id` is unscheduled and deleted from Garmin Connect before uploading replacements.
5. **Uploads & Schedules Future Workouts to Fenix 7S**:
   - **`running`** (`sportTypeId: 1`): Uploads structured steps (`warmup`, `interval`, `recovery`, `cooldown`, `repeat`) with distance (`distance_km`) or time (`duration_min`) end conditions and HR (`hr_min`/`hr_max` or `hr_zone`) or pace (`pace_min_per_km`) targets, and schedules the workout on `date` on the Fenix 7S Training Calendar.
   - **`strength_training`** (`sportTypeId: 5`): Uploads a calendar-scheduled strength workout with planned duration and focus/intensity description (timed step without granular per-set FIT SDK rep-counting prompts).
   - **`rest`**: Stored in SQLite and marked `rest` without uploading a watch workout.
6. **Reconciles Completion Statuses**: Runs `reconcile_plan_completions()` against synced activities (`done` ≥ 80% of target km/duration, `partial` < 80%, `missed` if `date < today` with no matching activity, `pending` if `date >= today`).

### 3.2 Sample Training Plan YAML (`sample_plan.yaml`)
```yaml
name: "Autumn 10K & Strength Block"
notes: "Polarized running with 2x weekly kettlebell/barbell strength sessions"
stammdaten:
  - category: "Athleten-Profil"
    parameter: "Maximalpuls (HFmax)"
    value: "188"
    unit_or_range: "bpm"
    reference_note: "Sportordination 10.08.2026"
  - category: "Trainingszonen"
    parameter: "GA1 / Zone 2"
    value: "135 - 148"
    unit_or_range: "bpm"
    reference_note: "Aerobe Schwelle (LT1)"
days:
  - date: "2026-11-02"
    sport_type: "running"
    workout_title: "Easy Aerobic Run"
    focus: "Zone 2 aerobic base"
    goal_km: 8.0
    goal_duration_min: 44.0
    hr_goal_label: "Z2 (135-148 bpm)"
    hr_min: 135
    hr_max: 148
    steps:
      - kind: "warmup"
        duration_min: 10.0
        hr_min: 120
        hr_max: 138
      - kind: "interval"
        distance_km: 6.0
        hr_min: 135
        hr_max: 148
      - kind: "cooldown"
        duration_min: 5.0
        hr_min: 115
        hr_max: 132

  - date: "2026-11-03"
    sport_type: "strength_training"
    workout_title: "Full Body Strength A"
    focus: "Squat, overhead press, weighted pull-ups, core stability"
    goal_duration_min: 45.0
    hr_goal_label: "Avg < 135 bpm"
    hr_min: 95
    hr_max: 135

  - date: "2026-11-04"
    sport_type: "rest"
    workout_title: "Rest & Mobility"
    focus: "Active recovery and foam rolling"

  - date: "2026-11-05"
    sport_type: "running"
    workout_title: "Threshold Cruise Intervals"
    focus: "4 x 1.5 km at lactate threshold with 2 min jog recovery"
    goal_km: 10.0
    goal_duration_min: 50.0
    hr_goal_label: "Z4 (162-172 bpm)"
    hr_min: 162
    hr_max: 172
    steps:
      - kind: "warmup"
        distance_km: 2.0
        hr_zone: 2
      - kind: "repeat"
        repeats: 4
        steps:
          - kind: "interval"
            distance_km: 1.5
            hr_min: 162
            hr_max: 172
            pace_min_per_km: "4:15-4:25"
          - kind: "recovery"
            duration_min: 2.0
            hr_zone: 1
      - kind: "cooldown"
        distance_km: 2.0
        hr_zone: 1
```

### 3.3 Applying a Plan or Stammdaten Update on `pepnet.at`
```bash
# Copy or write the updated plan (including optional stammdaten) inside /opt/pepnet/garmin-monitor/data/plan.yaml
docker exec garmin-monitor python -m garmin_monitor plan apply /data/plan.yaml

# Verify the updated plan and stammdaten summaries
docker exec garmin-monitor python -m garmin_monitor plan summary
docker exec garmin-monitor python -m garmin_monitor stammdaten summary

# Export or apply standalone Stammdaten
docker exec garmin-monitor python -m garmin_monitor stammdaten export > stammdaten.yaml
docker exec garmin-monitor python -m garmin_monitor stammdaten apply /data/plan.yaml
```
