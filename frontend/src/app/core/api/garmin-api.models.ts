export type SportType = 'running' | 'strength_training' | 'rest';
export type PlanDayStatus = 'done' | 'partial' | 'missed' | 'pending' | 'rest';
export type WarningSeverity = 'critical' | 'warning';
export type WarningCode =
  | 'sync_stale'
  | 'sync_failed'
  | 'hrv_status'
  | 'hrv_below_baseline'
  | 'sleep_consecutive_low'
  | 'sleep_poor'
  | 'resting_hr_elevated'
  | 'body_battery_low';

export type TrainingWeekWindow = 4 | 12 | 26;
export type HealthDayWindow = 7 | 30 | 90;

export interface SyncStatusResponse {
  is_syncing: boolean;
  last_sync_started_at: string | null;
  last_sync_finished_at: string | null;
  last_sync_status: string | null;
  activities_synced: number;
  health_days_synced: number;
  error_message: string | null;
  timezone: string;
}

export interface SyncResultResponse {
  run_id: number;
  days_synced: number;
  activities_synced: number;
  health_days_synced: number;
  start_date: string;
  end_date: string;
}

export interface CompletedWorkoutItem {
  activity_id: number;
  activity_name: string;
  sport_type: string;
  start_time_local: string;
  date_local: string;
  duration_min: number;
  distance_km: number;
  avg_hr: number | null;
  max_hr: number | null;
  calories: number | null;
  training_load: number | null;
}

export interface WeeklyTrainingPoint {
  iso_week_label: string;
  week_start: string;
  week_end: string;
  running_km: number;
  strength_minutes: number;
  workout_count: number;
}

export interface TrainingDashboardResponse {
  reference_date: string;
  current_week_start: string;
  current_week_end: string;
  ran_km_this_week: number;
  strength_minutes_this_week: number;
  completed_workouts_this_week: number;
  current_week_activities: CompletedWorkoutItem[];
  weekly_series: WeeklyTrainingPoint[];
}

export interface PlanDayItem {
  date: string;
  sport_type: SportType;
  workout_title: string;
  focus: string | null;
  goal_km: number | null;
  goal_duration_min: number | null;
  hr_goal_label: string | null;
  hr_min: number | null;
  hr_max: number | null;
  actual_km: number | null;
  actual_duration_min: number | null;
  actual_avg_hr: number | null;
  actual_max_hr: number | null;
  garmin_workout_id: number | null;
  garmin_schedule_id: number | null;
  status: PlanDayStatus;
}

export interface TrainingPlanResponse {
  has_active_plan: boolean;
  plan_id: number | null;
  name: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  updated_at: string | null;
  days: PlanDayItem[];
}

export interface PlanSyncResponse {
  uploaded_workouts: number;
}

export interface HealthWarning {
  code: WarningCode;
  severity: WarningSeverity;
  title: string;
  metric: string;
  observed_value: string;
  baseline_or_threshold: string;
  description: string;
  date: string | null;
}

export interface HealthKpiSummary {
  hrv_nightly_avg: number | null;
  hrv_weekly_avg: number | null;
  hrv_baseline_low: number | null;
  hrv_baseline_high: number | null;
  hrv_status: string | null;
  sleep_score: number | null;
  sleep_qualifier: string | null;
  sleep_total_min: number | null;
  resting_hr: number | null;
  resting_hr_30d_mean: number | null;
  body_battery_high: number | null;
  body_battery_low: number | null;
  stress_avg: number | null;
  training_readiness_score: number | null;
  training_readiness_level: string | null;
  spo2_avg: number | null;
  respiration_avg: number | null;
  steps: number | null;
}

export interface DailyHealthPoint {
  date: string;
  sleep_score: number | null;
  sleep_qualifier: string | null;
  sleep_total_min: number | null;
  sleep_deep_min: number | null;
  sleep_light_min: number | null;
  sleep_rem_min: number | null;
  sleep_awake_min: number | null;
  hrv_nightly_avg: number | null;
  hrv_weekly_avg: number | null;
  hrv_baseline_low: number | null;
  hrv_baseline_high: number | null;
  hrv_status: string | null;
  resting_hr: number | null;
  min_hr: number | null;
  max_hr: number | null;
  stress_avg: number | null;
  stress_max: number | null;
  body_battery_high: number | null;
  body_battery_low: number | null;
  spo2_avg: number | null;
  respiration_avg: number | null;
  steps: number | null;
  training_readiness_score: number | null;
  training_readiness_level: string | null;
}

export interface HealthDashboardResponse {
  days_requested: number;
  latest_date: string | null;
  warnings: HealthWarning[];
  kpis: HealthKpiSummary;
  series: DailyHealthPoint[];
}
