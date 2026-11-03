"""Builder translating PlanDaySpec definitions into Garmin Connect workout JSON payloads."""

from typing import Any

from garmin_monitor.plan_schema import PlanDaySpec, StepKind, WorkoutStepSpec

type GarminPayload = dict[str, Any]

RUNNING_SPORT_TYPE: GarminPayload = {
    "sportTypeId": 1,
    "sportTypeKey": "running",
    "displayOrder": 1,
}
STRENGTH_SPORT_TYPE: GarminPayload = {
    "sportTypeId": 5,
    "sportTypeKey": "strength_training",
    "displayOrder": 5,
}

STEP_TYPE_MAP: dict[StepKind, GarminPayload] = {
    "warmup": {"stepTypeId": 1, "stepTypeKey": "warmup", "displayOrder": 1},
    "cooldown": {"stepTypeId": 2, "stepTypeKey": "cooldown", "displayOrder": 2},
    "interval": {"stepTypeId": 3, "stepTypeKey": "interval", "displayOrder": 3},
    "recovery": {"stepTypeId": 4, "stepTypeKey": "recovery", "displayOrder": 4},
    "repeat": {"stepTypeId": 6, "stepTypeKey": "repeat", "displayOrder": 6},
    "main": {"stepTypeId": 8, "stepTypeKey": "main", "displayOrder": 8},
}

NO_TARGET: GarminPayload = {
    "workoutTargetTypeId": 1,
    "workoutTargetTypeKey": "no.target",
    "displayOrder": 1,
}
HR_TARGET_TYPE: GarminPayload = {
    "workoutTargetTypeId": 4,
    "workoutTargetTypeKey": "heart.rate.zone",
    "displayOrder": 4,
}
PACE_TARGET_TYPE: GarminPayload = {
    "workoutTargetTypeId": 6,
    "workoutTargetTypeKey": "pace.zone",
    "displayOrder": 6,
}


def _parse_pace_string_to_mps(pace_str: str) -> float:
    """Convert a 'MM:SS' per-km pace string into meters per second."""
    parts = pace_str.strip().split(":")
    if len(parts) != 2:
        raise ValueError(f"Invalid pace format '{pace_str}', expected 'MM:SS'")
    minutes = int(parts[0])
    seconds = int(parts[1])
    total_sec = minutes * 60 + seconds
    if total_sec <= 0:
        raise ValueError(f"Pace duration must be positive: '{pace_str}'")
    return round(1000.0 / total_sec, 4)


def _parse_pace_range_to_mps(pace_spec: str) -> tuple[float, float]:
    """Convert '4:40-5:00' or '4:50' min/km into (lower_mps, upper_mps)."""
    cleaned = pace_spec.replace("/km", "").strip()
    if "-" in cleaned:
        fast_str, slow_str = cleaned.split("-", 1)
        mps_a = _parse_pace_string_to_mps(fast_str)
        mps_b = _parse_pace_string_to_mps(slow_str)
        return min(mps_a, mps_b), max(mps_a, mps_b)
    center = _parse_pace_string_to_mps(cleaned)
    return round(center * 0.97, 4), round(center * 1.03, 4)


def _build_target_fields(
    step: WorkoutStepSpec,
    default_hr_min: int | None,
    default_hr_max: int | None,
) -> GarminPayload:
    """Construct targetType and target value fields for an ExecutableStepDTO."""
    if step.hr_zone is not None:
        return {
            "targetType": HR_TARGET_TYPE,
            "zoneNumber": step.hr_zone,
        }
    if step.hr_min is not None and step.hr_max is not None:
        return {
            "targetType": HR_TARGET_TYPE,
            "targetValueOne": float(step.hr_min),
            "targetValueTwo": float(step.hr_max),
        }
    if step.pace_min_per_km:
        low_mps, high_mps = _parse_pace_range_to_mps(step.pace_min_per_km)
        return {
            "targetType": PACE_TARGET_TYPE,
            "targetValueOne": low_mps,
            "targetValueTwo": high_mps,
        }
    if default_hr_min is not None and default_hr_max is not None:
        return {
            "targetType": HR_TARGET_TYPE,
            "targetValueOne": float(default_hr_min),
            "targetValueTwo": float(default_hr_max),
        }
    return {"targetType": NO_TARGET}


def _build_end_condition(step: WorkoutStepSpec) -> tuple[GarminPayload, float | None]:
    """Construct endCondition and endConditionValue in meters or seconds."""
    if step.distance_km is not None:
        return (
            {
                "conditionTypeId": 3,
                "conditionTypeKey": "distance",
                "displayOrder": 3,
                "displayable": True,
            },
            round(step.distance_km * 1000.0, 1),
        )
    if step.duration_min is not None:
        return (
            {
                "conditionTypeId": 2,
                "conditionTypeKey": "time",
                "displayOrder": 2,
                "displayable": True,
            },
            round(step.duration_min * 60.0, 1),
        )
    return (
        {
            "conditionTypeId": 1,
            "conditionTypeKey": "lap.button",
            "displayOrder": 1,
            "displayable": True,
        },
        None,
    )


def _build_step_dto(
    step: WorkoutStepSpec,
    order_counter: list[int],
    default_hr_min: int | None,
    default_hr_max: int | None,
) -> tuple[GarminPayload, int]:
    """Recursively build an ExecutableStepDTO or RepeatGroupDTO and estimated duration (sec)."""
    order_counter[0] += 1
    current_order = order_counter[0]

    if step.kind == "repeat" and step.repeats and step.steps:
        child_dtos: list[GarminPayload] = []
        single_iter_sec = 0
        for child in step.steps:
            child_dto, child_sec = _build_step_dto(
                child,
                order_counter,
                default_hr_min,
                default_hr_max,
            )
            child_dtos.append(child_dto)
            single_iter_sec += child_sec

        dto: GarminPayload = {
            "type": "RepeatGroupDTO",
            "stepOrder": current_order,
            "stepType": STEP_TYPE_MAP["repeat"],
            "numberOfIterations": step.repeats,
            "endCondition": {
                "conditionTypeId": 7,
                "conditionTypeKey": "iterations",
                "displayOrder": 7,
                "displayable": False,
            },
            "endConditionValue": float(step.repeats),
            "smartRepeat": False,
            "workoutSteps": child_dtos,
        }
        return dto, single_iter_sec * step.repeats

    end_cond, end_val = _build_end_condition(step)
    target_fields = _build_target_fields(step, default_hr_min, default_hr_max)
    step_dto: GarminPayload = {
        "type": "ExecutableStepDTO",
        "stepOrder": current_order,
        "stepType": STEP_TYPE_MAP.get(step.kind, STEP_TYPE_MAP["interval"]),
        "endCondition": end_cond,
        **target_fields,
    }
    if end_val is not None:
        step_dto["endConditionValue"] = end_val
    if step.description:
        step_dto["description"] = step.description

    estimated_sec = 0
    if step.duration_min is not None:
        estimated_sec = round(step.duration_min * 60.0)
    elif step.distance_km is not None:
        estimated_sec = round(step.distance_km * 330.0)
    return step_dto, estimated_sec


def _build_running_workout(day: PlanDaySpec) -> GarminPayload:
    """Build a structured running workout payload for Garmin Connect."""
    effective_steps = list(day.steps)
    if not effective_steps:
        effective_steps = [
            WorkoutStepSpec(
                kind="interval",
                distance_km=day.goal_km,
                duration_min=day.goal_duration_min if day.goal_km is None else None,
                hr_min=day.hr_min,
                hr_max=day.hr_max,
                description=day.focus,
            )
        ]

    order_counter = [0]
    built_steps: list[GarminPayload] = []
    total_estimated_sec = 0
    for step in effective_steps:
        dto, est_sec = _build_step_dto(
            step,
            order_counter,
            default_hr_min=day.hr_min,
            default_hr_max=day.hr_max,
        )
        built_steps.append(dto)
        total_estimated_sec += est_sec

    if day.goal_duration_min is not None and total_estimated_sec == 0:
        total_estimated_sec = round(day.goal_duration_min * 60.0)

    payload: GarminPayload = {
        "workoutName": day.workout_title,
        "sportType": RUNNING_SPORT_TYPE,
        "estimatedDurationInSecs": max(total_estimated_sec, 60),
        "workoutSegments": [
            {
                "segmentOrder": 1,
                "sportType": RUNNING_SPORT_TYPE,
                "workoutSteps": built_steps,
            }
        ],
    }
    if day.focus:
        payload["description"] = day.focus
    return payload


def _build_strength_workout(day: PlanDaySpec) -> GarminPayload:
    """Build a calendar-scheduled strength workout with planned duration and focus description."""
    duration_min = day.goal_duration_min if day.goal_duration_min is not None else 45.0
    duration_sec = max(round(duration_min * 60.0), 60)
    description_parts = [p for p in (day.focus, day.hr_goal_label) if p]
    description = " | ".join(description_parts) if description_parts else day.workout_title

    target_fields = _build_target_fields(
        WorkoutStepSpec(kind="interval", duration_min=duration_min),
        default_hr_min=day.hr_min,
        default_hr_max=day.hr_max,
    )

    step_dto: GarminPayload = {
        "type": "ExecutableStepDTO",
        "stepOrder": 1,
        "stepType": STEP_TYPE_MAP["interval"],
        "endCondition": {
            "conditionTypeId": 2,
            "conditionTypeKey": "time",
            "displayOrder": 2,
            "displayable": True,
        },
        "endConditionValue": float(duration_sec),
        "description": description,
        **target_fields,
    }

    return {
        "workoutName": day.workout_title,
        "description": description,
        "sportType": STRENGTH_SPORT_TYPE,
        "estimatedDurationInSecs": duration_sec,
        "workoutSegments": [
            {
                "segmentOrder": 1,
                "sportType": STRENGTH_SPORT_TYPE,
                "workoutSteps": [step_dto],
            }
        ],
    }


def build_garmin_workout_payload(day: PlanDaySpec) -> GarminPayload | None:
    """Translate a PlanDaySpec into a Garmin Connect workout payload, or None for rest days."""
    match day.sport_type:
        case "rest":
            return None
        case "running":
            return _build_running_workout(day)
        case "strength_training":
            return _build_strength_workout(day)
