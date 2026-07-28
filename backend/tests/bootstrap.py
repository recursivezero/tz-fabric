"""Create the minimal local env file required by the legacy test bootstrap.

The application currently requires ``.env.development`` during module import.
Tests create a temporary file only when a developer has not supplied one and
remove it automatically when the test process exits.
"""

from __future__ import annotations

import atexit
from pathlib import Path

_ENV_PATH = Path(".env.development")
_CREATED_ENV = False

if not _ENV_PATH.exists():
    _ENV_PATH.write_text(
        "\n".join(
            (
                'ENVIRONMENT="development"',
                'INTERNAL_API_KEY="test-admin-secret"',
                'AWS_PUBLIC_URL="https://assets.threadzip.com"',
                'AWS_BUCKET_NAME="test-bucket"',
                "",
            )
        ),
        encoding="utf-8",
    )
    _CREATED_ENV = True


def _cleanup() -> None:
    if _CREATED_ENV:
        _ENV_PATH.unlink(missing_ok=True)


atexit.register(_cleanup)
