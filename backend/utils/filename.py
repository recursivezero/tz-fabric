import re
from pathlib import Path
from datetime import datetime, timezone


def sanitize_filename(filename: str) -> str:
    # strips extension properly even for dotfiles like .bashrc
    base = Path(filename).stem  # ✅ better than rsplit(".", 1)[0]

    # collapse whitespace to underscore instead of removing — more readable
    base = re.sub(r"\s+", "_", base)

    # keep only alphanumeric, underscore, hyphen
    base = re.sub(r"[^\w\-]", "", base).lower()

    # collapse multiple underscores/hyphens
    base = re.sub(r"[_\-]{2,}", "_", base)

    # strip leading/trailing underscores or hyphens
    base = base.strip("_-")

    if not base:
        base = "file"

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    return f"{base}_{timestamp}"
