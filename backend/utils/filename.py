import re
from datetime import datetime


def sanitize_filename(filename: str) -> str:
    base = filename.rsplit(".", 1)[0]
    base = re.sub(r"\s+", "", base)
    base = re.sub(r"[^\w]", "", base).lower()

    if not base:
        base = "file"

    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
    return f"{base}_{timestamp}"
