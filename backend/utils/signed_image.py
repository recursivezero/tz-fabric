import hashlib
import hmac
import time


def create_signed_image_url(
    key: str,
    secret: str,
    assets_url: str = "https://assets.threadzip.com",
    expires_in_seconds: int = 600,
) -> str:
    """
    Generate a signed image URL compatible with tz-server's
    createSignedImageUrl() implementation.
    """

    if not secret:
        raise ValueError("IMAGE_SIGNING_SECRET is not configured")

    expires = int(time.time()) + expires_in_seconds

    # Must match the TypeScript implementation exactly:
    # `${expires}:${key}`
    data = f"{expires}:{key}"

    # HMAC-SHA256
    signature = hmac.new(
        secret.encode("utf-8"),
        data.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return f"{assets_url.rstrip('/')}/{key}?access={expires}.{signature}"
