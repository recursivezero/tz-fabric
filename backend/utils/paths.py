# utils/paths.py
from pathlib import Path
from typing import Optional
from constants import IMAGE_DIR, AUDIO_DIR, PROJECT_DIR

def _url_from_path(dir_path: Path, filename: str, api_prefix: str = "/api") -> Optional[str]:
    if not filename:
        return None
    try:
        relative = dir_path.relative_to(PROJECT_DIR).as_posix()  # "assets/images"
    except Exception:
        relative = dir_path.as_posix().lstrip("/")
    return f"{api_prefix}/{relative}/{filename}"

def build_image_url(filename: str) -> Optional[str]:
    return _url_from_path(IMAGE_DIR, filename, api_prefix="/api")

def build_audio_url(filename: str) -> Optional[str]:
    return _url_from_path(AUDIO_DIR, filename, api_prefix="/api")
