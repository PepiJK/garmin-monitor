"""Pydantic v2 models and YAML/JSON serialization for training plans."""

import json
from datetime import date
from pathlib import Path
from typing import Any, Literal, Self, override

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

type SportType = Literal["running", "strength_training", "rest"]
type PlanDayStatus = Literal["done", "partial", "missed", "pending", "rest"]
type StepKind = Literal["warmup", "interval", "recovery", "cooldown", "repeat", "main"]


class WorkoutStepSpec(BaseModel):
    """Structured workout step definition for running or strength sessions."""

    model_config = ConfigDict(extra="forbid")

    kind: StepKind = "interval"
    duration_min: float | None = Field(default=None, gt=0.0)
    distance_km: float | None = Field(default=None, gt=0.0)
    hr_zone: int | None = Field(default=None, ge=1, le=5)
    hr_min: int | None = Field(default=None, ge=30, le=240)
    hr_max: int | None = Field(default=None, ge=30, le=240)
    pace_min_per_km: str | None = None
    repeats: int | None = Field(default=None, ge=1, le=50)
    steps: list[WorkoutStepSpec] = Field(default_factory=list)
    description: str | None = None

    @model_validator(mode="after")
    def validate_step_constraints(self) -> Self:
        """Validate HR bounds and repeat group structure."""
        if self.hr_min is not None and self.hr_max is not None and self.hr_min > self.hr_max:
            raise ValueError("hr_min cannot be greater than hr_max")
        if self.kind == "repeat" and (not self.repeats or not self.steps):
            raise ValueError("repeat steps require both 'repeats' >= 1 and non-empty 'steps'")
        return self


class StammdatenEntrySpec(BaseModel):
    """Single row of athlete master data / performance diagnostics (Stammdaten)."""

    model_config = ConfigDict(extra="forbid")

    category: str
    parameter: str
    value: str
    unit_or_range: str | None = None
    reference_note: str | None = None


class StammdatenSpec(BaseModel):
    """Standalone Stammdaten payload for CLI import/export."""

    model_config = ConfigDict(extra="forbid")

    stammdaten: list[StammdatenEntrySpec]


class PlanDaySpec(BaseModel):
    """Single calendar day within a training plan."""

    model_config = ConfigDict(extra="forbid")

    date: date
    sport_type: SportType
    workout_title: str
    focus: str | None = None
    goal_km: float | None = Field(default=None, ge=0.0)
    goal_duration_min: float | None = Field(default=None, ge=0.0)
    hr_goal_label: str | None = None
    hr_min: int | None = Field(default=None, ge=30, le=240)
    hr_max: int | None = Field(default=None, ge=30, le=240)
    steps: list[WorkoutStepSpec] = Field(default_factory=list)
    status: PlanDayStatus | None = None
    actual_km: float | None = Field(default=None, ge=0.0)
    actual_duration_min: float | None = Field(default=None, ge=0.0)
    actual_avg_hr: int | None = Field(default=None, ge=30, le=240)
    actual_max_hr: int | None = Field(default=None, ge=30, le=240)
    actual_pace_min_per_km: str | None = None
    actual_cadence_spm: int | None = Field(default=None, ge=0)
    actual_stride_m: float | None = Field(default=None, ge=0.0)
    actual_power_w: int | None = Field(default=None, ge=0)
    actual_training_load: float | None = Field(default=None, ge=0.0)
    actual_aerobic_te: float | None = Field(default=None, ge=0.0)
    actual_anaerobic_te: float | None = Field(default=None, ge=0.0)
    actual_calories: int | None = Field(default=None, ge=0)
    rpe: int | None = Field(default=None, ge=1, le=10)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_day_constraints(self) -> Self:
        """Ensure HR range and default HR label consistency."""
        if self.hr_min is not None and self.hr_max is not None and self.hr_min > self.hr_max:
            raise ValueError(f"Day {self.date}: hr_min ({self.hr_min}) > hr_max ({self.hr_max})")
        if self.hr_goal_label is None and self.hr_min is not None and self.hr_max is not None:
            self.hr_goal_label = f"{self.hr_min}-{self.hr_max} bpm"
        return self

    @override
    def model_post_init(self, __context: Any) -> None:
        """Normalize empty titles on rest days."""
        if not self.workout_title.strip():
            self.workout_title = "Rest Day" if self.sport_type == "rest" else "Workout"


class TrainingPlanSpec(BaseModel):
    """Complete multi-day training plan definition."""

    model_config = ConfigDict(extra="forbid")

    name: str
    notes: str | None = None
    stammdaten: list[StammdatenEntrySpec] | None = None
    days: list[PlanDaySpec]

    @model_validator(mode="after")
    def validate_unique_sorted_days(self) -> Self:
        """Verify that the plan has at least one day and no duplicate dates."""
        if not self.days:
            raise ValueError("Training plan must contain at least one day")
        seen: set[date] = set()
        for day in self.days:
            if day.date in seen:
                raise ValueError(f"Duplicate date in training plan: {day.date.isoformat()}")
            seen.add(day.date)
        self.days = sorted(self.days, key=lambda d: d.date)
        return self

    @property
    def start_date(self) -> date:
        """Return the earliest date in the plan."""
        return self.days[0].date

    @property
    def end_date(self) -> date:
        """Return the latest date in the plan."""
        return self.days[-1].date


def load_plan_from_text(raw_content: str) -> TrainingPlanSpec:
    """Parse and validate a YAML or JSON training plan string."""
    stripped = raw_content.strip()
    if stripped.startswith("{"):
        parsed = json.loads(stripped)
    else:
        parsed = yaml.safe_load(stripped)
    if not isinstance(parsed, dict):
        raise ValueError("Training plan file must deserialize to a mapping/object")
    return TrainingPlanSpec.model_validate(parsed)


def load_plan_from_file(path: Path) -> tuple[TrainingPlanSpec, str]:
    """Load and validate a YAML or JSON training plan file, returning (spec, raw_text)."""
    raw_text = path.read_text(encoding="utf-8")
    spec = load_plan_from_text(raw_text)
    return spec, raw_text


def load_stammdaten_from_file(path: Path) -> list[StammdatenEntrySpec]:
    """Load and validate Stammdaten entries from a YAML/JSON file."""
    raw_text = path.read_text(encoding="utf-8")
    stripped = raw_text.strip()
    parsed = json.loads(stripped) if stripped.startswith("{") else yaml.safe_load(stripped)
    if isinstance(parsed, list):
        return [StammdatenEntrySpec.model_validate(item) for item in parsed]
    if isinstance(parsed, dict) and "stammdaten" in parsed:
        return [StammdatenEntrySpec.model_validate(item) for item in parsed["stammdaten"]]
    raise ValueError("Stammdaten file must contain a 'stammdaten' list or top-level list")


def dump_stammdaten_to_yaml(entries: list[StammdatenEntrySpec]) -> str:
    """Serialize Stammdaten entries into clean YAML."""
    spec = StammdatenSpec(stammdaten=entries)
    payload = spec.model_dump(mode="json", exclude_none=True)
    return yaml.safe_dump(payload, sort_keys=False, allow_unicode=True)


def dump_plan_to_yaml(plan: TrainingPlanSpec) -> str:
    """Serialize a TrainingPlanSpec into clean, human/AI-editable YAML."""
    payload = plan.model_dump(mode="json", exclude_none=True, exclude_defaults=False)
    for day in payload.get("days", []):
        if not day.get("steps"):
            day.pop("steps", None)
    return yaml.safe_dump(payload, sort_keys=False, allow_unicode=True)
