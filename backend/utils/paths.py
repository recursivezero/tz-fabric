# utils/paths.py
from pathlib import Path
from typing import Optional

from constants import API_PREFIX, AUDIO_DIR, IMAGE_DIR, PROJECT_DIR


def _url_from_path(dir_path: Path, filename: str, api_prefix: str = API_PREFIX) -> Optional[str]:
    if not filename:
        return None
    try:
        relative = dir_path.relative_to(PROJECT_DIR).as_posix()
    except Exception:
        relative = dir_path.as_posix().lstrip("/")
    return f"{api_prefix}/{relative}/{filename}"


def build_image_url(filename: str) -> Optional[str]:
    return _url_from_path(IMAGE_DIR, filename, api_prefix=API_PREFIX)


def build_audio_url(filename: str) -> Optional[str]:
    return _url_from_path(AUDIO_DIR, filename, api_prefix=API_PREFIX)
