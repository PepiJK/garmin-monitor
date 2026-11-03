"""Command-line interface for Garmin Monitor auth bootstrap, sync, and training plans."""

import argparse
import getpass
import sys
from collections.abc import Sequence
from pathlib import Path

from garmin_monitor.config import Settings, get_settings
from garmin_monitor.db import connect_db, init_db
from garmin_monitor.garmin_client import GarminClient
from garmin_monitor.plan_schema import load_plan_from_file
from garmin_monitor.plan_service import (
    apply_plan,
    export_active_plan_yaml,
    get_active_plan_with_days,
    sync_future_plan_to_garmin,
)
from garmin_monitor.sync_service import SyncService


def build_parser() -> argparse.ArgumentParser:
    """Build the top-level CLI argument parser."""
    parser = argparse.ArgumentParser(
        prog="garmin_monitor",
        description="Garmin Monitor CLI for token bootstrap, synchronization, and training plans.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    auth_parser = subparsers.add_parser("auth", help="Garmin Connect authentication commands")
    auth_sub = auth_parser.add_subparsers(dest="auth_command", required=True)
    login_parser = auth_sub.add_parser(
        "login",
        help="Interactively authenticate with Garmin Connect and persist session tokens",
    )
    login_parser.add_argument("--email", help="Garmin Connect email (defaults to GARMIN_EMAIL)")
    login_parser.add_argument(
        "--password", help="Garmin Connect password (defaults to GARMIN_PASSWORD)"
    )
    login_parser.add_argument(
        "--token-dir",
        type=Path,
        help="Token directory (defaults to GARMIN_TOKEN_DIR)",
    )

    sync_parser = subparsers.add_parser(
        "sync",
        help="Synchronize Garmin Connect activities and daily health records into SQLite",
    )
    sync_parser.add_argument(
        "--days",
        type=int,
        default=None,
        help="Number of days to sync (default: 90 on empty DB, 2 otherwise)",
    )

    plan_parser = subparsers.add_parser("plan", help="Manage and sync the active training plan")
    plan_sub = plan_parser.add_subparsers(dest="plan_command", required=True)

    plan_sub.add_parser("summary", help="Print a summary table of the active training plan")

    export_parser = plan_sub.add_parser(
        "export",
        help="Export the active training plan as YAML",
    )
    export_parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=None,
        help="Optional output file path (prints to stdout if omitted)",
    )

    apply_parser = plan_sub.add_parser(
        "apply",
        help="Validate and apply a YAML/JSON training plan and reconcile Fenix 7S workouts",
    )
    apply_parser.add_argument("file", type=Path, help="Path to YAML or JSON training plan file")
    apply_parser.add_argument(
        "--no-garmin-sync",
        action="store_true",
        help="Persist plan in SQLite without uploading/scheduling workouts on Garmin Connect",
    )

    plan_sync_parser = plan_sub.add_parser(
        "sync",
        help="Upload and schedule pending future workouts from SQLite onto the Fenix 7S calendar",
    )
    plan_sync_parser.add_argument(
        "--force",
        action="store_true",
        help="Re-upload and re-schedule all future workouts even if already synced",
    )

    return parser


def handle_auth_login(args: argparse.Namespace, settings: Settings) -> int:
    """Execute interactive Garmin authentication and save session tokens."""
    email = args.email or settings.garmin_email or input("Garmin email: ").strip()
    password = args.password or settings.garmin_password or getpass.getpass("Garmin password: ")
    token_dir: Path = args.token_dir or settings.garmin_token_dir

    client = GarminClient(token_dir)
    saved_dir = client.interactive_login(email=email, password=password)
    print(f"Garmin session tokens saved to {saved_dir}")
    return 0


def handle_sync(args: argparse.Namespace, settings: Settings) -> int:
    """Execute activity and daily health synchronization."""
    service = SyncService(settings)
    result = service.sync(days=args.days)
    print(
        f"Sync completed (run_id={result.run_id}): "
        f"{result.activities_synced} activities, "
        f"{result.health_days_synced} health days "
        f"({result.start_date} .. {result.end_date})"
    )
    return 0


def handle_plan_summary(settings: Settings) -> int:
    """Display the active training plan and goal-vs-actual status rows."""
    init_db(settings.database_path)
    with connect_db(settings.database_path) as conn:
        plan_row, day_rows = get_active_plan_with_days(conn)
        if plan_row is None:
            print("No active training plan configured.")
            return 0

        print(f"Plan: {plan_row['name']} ({plan_row['start_date']} .. {plan_row['end_date']})")
        if plan_row.get("notes"):
            print(f"Notes: {plan_row['notes']}")
        print("-" * 88)
        print(
            f"{'Date':<12} {'Sport':<18} {'Workout':<24} {'Goal':<12} {'Actual':<12} {'Status':<8}"
        )
        print("-" * 88)
        for row in day_rows:
            goal_str = (
                f"{row['goal_km']:.1f} km"
                if row["goal_km"] is not None
                else (
                    f"{row['goal_duration_min']:.0f} min"
                    if row["goal_duration_min"] is not None
                    else "-"
                )
            )
            actual_str = (
                f"{row['actual_km']:.1f} km"
                if row["sport_type"] == "running" and row["actual_km"] is not None
                else (
                    f"{row['actual_duration_min']:.0f} min"
                    if row["actual_duration_min"] is not None
                    else "-"
                )
            )
            print(
                f"{row['date']:<12} {row['sport_type']:<18} "
                f"{str(row['workout_title'])[:23]:<24} {goal_str:<12} "
                f"{actual_str:<12} {row['status']:<8}"
            )
    return 0


def handle_plan_export(args: argparse.Namespace, settings: Settings) -> int:
    """Export the active training plan to stdout or file."""
    yaml_text = export_active_plan_yaml(settings)
    if args.output is not None:
        args.output.write_text(yaml_text, encoding="utf-8")
        print(f"Exported active plan to {args.output}")
    else:
        print(yaml_text, end="")
    return 0


def handle_plan_apply(args: argparse.Namespace, settings: Settings) -> int:
    """Validate and apply a training plan file."""
    spec, raw_text = load_plan_from_file(args.file)
    result = apply_plan(
        settings,
        spec,
        raw_text,
        sync_to_garmin=not args.no_garmin_sync,
    )
    print(
        f"Applied plan '{result.plan_name}' (id={result.plan_id}): "
        f"{result.total_days} days, "
        f"{result.preserved_past_days} past completed preserved, "
        f"{result.deleted_workouts} deleted, "
        f"{result.uploaded_workouts} uploaded/scheduled."
    )
    return 0


def handle_plan_sync(args: argparse.Namespace, settings: Settings) -> int:
    """Sync pending future plan workouts to the Fenix 7S calendar."""
    uploaded = sync_future_plan_to_garmin(settings, force=args.force)
    print(f"Synced {uploaded} future workouts to Garmin Connect calendar.")
    return 0


def main(argv: Sequence[str] | None = None, settings: Settings | None = None) -> int:
    """Entry point for the garmin_monitor CLI."""
    parser = build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)
    resolved_settings = settings or get_settings()

    match args.command:
        case "auth" if args.auth_command == "login":
            return handle_auth_login(args, resolved_settings)
        case "sync":
            return handle_sync(args, resolved_settings)
        case "plan":
            match args.plan_command:
                case "summary":
                    return handle_plan_summary(resolved_settings)
                case "export":
                    return handle_plan_export(args, resolved_settings)
                case "apply":
                    return handle_plan_apply(args, resolved_settings)
                case "sync":
                    return handle_plan_sync(args, resolved_settings)

    parser.print_help(sys.stderr)
    return 1
