"""Command-line interface for Garmin Monitor auth bootstrap and data sync."""

import argparse
import getpass
import sys
from collections.abc import Sequence
from pathlib import Path

from garmin_monitor.config import Settings, get_settings
from garmin_monitor.garmin_client import GarminClient
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


def main(argv: Sequence[str] | None = None, settings: Settings | None = None) -> int:
    """Entry point for the garmin_monitor CLI."""
    parser = build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)
    resolved_settings = settings or get_settings()

    if args.command == "auth" and args.auth_command == "login":
        return handle_auth_login(args, resolved_settings)
    if args.command == "sync":
        return handle_sync(args, resolved_settings)

    parser.print_help(sys.stderr)
    return 1
