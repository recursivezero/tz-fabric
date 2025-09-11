from pathlib import Path
Parent_DIR = Path(__file__).parent
ASSETS = Parent_DIR / "assets"
IMAGES_DIR = ASSETS / "images"
AUDIOS_DIR = ASSETS / "audios"
IMAGES_URL_BASE = "/api/assets/images"
AUDIOS_URL_BASE = "/api/assets/audios"