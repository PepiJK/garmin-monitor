"""Unit tests for WorkoutBuilder and PlanDaySpec/WorkoutStepSpec validation."""

from datetime import date

import pytest

from garmin_monitor.plan_schema import (
    PlanDaySpec,
    TrainingPlanSpec,
    WorkoutStepSpec,
    dump_plan_to_yaml,
    load_plan_from_text,
)
from garmin_monitor.workout_builder import build_garmin_workout_payload


def test_build_running_workout_with_repeats_hr_and_pace() -> None:
    """Running workouts build structured warmup, repeat group, and cooldown steps."""
    day = PlanDaySpec(
        date=date(2026, 11, 5),
        sport_type="running",
        workout_title="Threshold Intervals",
        focus="4x1.5km Z4",
        goal_km=10.0,
        goal_duration_min=50.0,
        hr_min=160,
        hr_max=172,
        steps=[
            WorkoutStepSpec(kind="warmup", distance_km=2.0, hr_zone=2),
            WorkoutStepSpec(
                kind="repeat",
                repeats=4,
                steps=[
                    WorkoutStepSpec(
                        kind="interval",
                        distance_km=1.5,
                        pace_min_per_km="4:15-4:30",
                    ),
                    WorkoutStepSpec(kind="recovery", duration_min=2.0),
                ],
            ),
            WorkoutStepSpec(kind="cooldown", duration_min=10.0, hr_min=120, hr_max=135),
        ],
    )
    payload = build_garmin_workout_payload(day)
    assert payload is not None
    assert payload["sportType"]["sportTypeId"] == 1
    assert payload["sportType"]["sportTypeKey"] == "running"
    assert payload["workoutName"] == "Threshold Intervals"

    steps = payload["workoutSegments"][0]["workoutSteps"]
    assert len(steps) == 3
    assert steps[0]["stepType"]["stepTypeKey"] == "warmup"
    assert steps[0]["endCondition"]["conditionTypeKey"] == "distance"
    assert steps[0]["endConditionValue"] == 2000.0
    assert steps[0]["zoneNumber"] == 2

    repeat_group = steps[1]
    assert repeat_group["type"] == "RepeatGroupDTO"
    assert repeat_group["numberOfIterations"] == 4
    assert len(repeat_group["workoutSteps"]) == 2
    assert repeat_group["workoutSteps"][0]["targetType"]["workoutTargetTypeKey"] == "pace.zone"

    cooldown = steps[2]
    assert cooldown["stepType"]["stepTypeKey"] == "cooldown"
    assert cooldown["targetValueOne"] == 120.0
    assert cooldown["targetValueTwo"] == 135.0


def test_build_default_running_strength_and_rest_workouts() -> None:
    """Running without explicit steps, strength workouts, and rest days translate properly."""
    rest_day = PlanDaySpec(
        date=date(2026, 11, 4),
        sport_type="rest",
        workout_title="",
    )
    assert rest_day.workout_title == "Rest Day"
    assert build_garmin_workout_payload(rest_day) is None

    simple_run = PlanDaySpec(
        date=date(2026, 11, 6),
        sport_type="running",
        workout_title="Easy Run",
        goal_km=7.5,
        hr_min=135,
        hr_max=148,
    )
    assert simple_run.hr_goal_label == "135-148 bpm"
    run_payload = build_garmin_workout_payload(simple_run)
    assert run_payload is not None
    assert run_payload["workoutSegments"][0]["workoutSteps"][0]["endConditionValue"] == 7500.0

    strength_day = PlanDaySpec(
        date=date(2026, 11, 7),
        sport_type="strength_training",
        workout_title="Kettlebell Full Body",
        focus="Swings, Turkish get-ups, goblet squats",
        goal_duration_min=45.0,
        hr_min=100,
        hr_max=138,
    )
    strength_payload = build_garmin_workout_payload(strength_day)
    assert strength_payload is not None
    assert strength_payload["sportType"]["sportTypeId"] == 5
    assert strength_payload["sportType"]["sportTypeKey"] == "strength_training"
    assert strength_payload["estimatedDurationInSecs"] == 2700
    step = strength_payload["workoutSegments"][0]["workoutSteps"][0]
    assert step["endCondition"]["conditionTypeKey"] == "time"
    assert step["endConditionValue"] == 2700.0
    assert "Swings" in step["description"]


def test_schema_validation_and_yaml_roundtrip() -> None:
    """Invalid HR bounds, empty repeats, or duplicate dates raise ValidationError."""
    with pytest.raises(ValueError, match="hr_min cannot be greater than hr_max"):
        WorkoutStepSpec(kind="interval", duration_min=10, hr_min=170, hr_max=150)

    with pytest.raises(ValueError, match="repeat steps require"):
        WorkoutStepSpec(kind="repeat", repeats=3, steps=[])

    with pytest.raises(ValueError, match="Duplicate date"):
        TrainingPlanSpec(
            name="Dupes",
            days=[
                PlanDaySpec(date=date(2026, 11, 2), sport_type="rest", workout_title="Rest"),
                PlanDaySpec(date=date(2026, 11, 2), sport_type="running", workout_title="Run"),
            ],
        )

    plan = TrainingPlanSpec(
        name="Roundtrip Plan",
        notes="Test notes",
        days=[
            PlanDaySpec(
                date=date(2026, 11, 3),
                sport_type="running",
                workout_title="Steady Run",
                goal_km=8.0,
            )
        ],
    )
    yaml_str = dump_plan_to_yaml(plan)
    reloaded = load_plan_from_text(yaml_str)
    assert reloaded.name == "Roundtrip Plan"
    assert len(reloaded.days) == 1
    assert reloaded.days[0].goal_km == 8.0
