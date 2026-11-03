"""Allow running the CLI via `python -m garmin_monitor`."""

import sys

from garmin_monitor.cli import main

if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main(sys.argv[1:]))
