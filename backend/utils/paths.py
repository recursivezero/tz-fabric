from urllib.parse import urljoin
from constants import IMAGES_URL_BASE, AUDIOS_URL_BASE

def build_image_url(filename: str) -> str | None:
    if not filename:
        return None
    return f"{IMAGES_URL_BASE.rstrip('/')}/{filename}"

def build_audio_url(filename: str) -> str | None:
    if not filename:
        return None
    return f"{AUDIOS_URL_BASE.rstrip('/')}/{filename}"
