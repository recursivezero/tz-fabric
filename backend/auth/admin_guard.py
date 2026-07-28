"""Reusable guard for private administrator endpoints.

The application does not currently have user accounts or role-based sessions.  The
existing internal secret is therefore the strongest authentication mechanism
available in this branch.  Keep the secret on the server and compare it in
constant time for every protected request.
"""

from secrets import compare_digest

from fastapi import HTTPException, Security, status
from fastapi.security.api_key import APIKeyHeader

from constants import API_KEY, IS_PROD

_ADMIN_HEADER = APIKeyHeader(name="X-Internal-Secret", auto_error=False)


def validate_admin_configuration() -> None:
    """Fail fast when production would expose an unusable admin surface."""

    if IS_PROD and not API_KEY:
        raise RuntimeError(
            "INTERNAL_API_KEY must be configured before starting in production."
        )


async def verify_admin_access(
    api_key: str | None = Security(_ADMIN_HEADER),
) -> str:
    """Authorize a request using the existing private internal secret."""

    if not API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Administrator access is not configured.",
        )

    if not api_key or not compare_digest(api_key, API_KEY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access was rejected.",
        )

    return api_key
