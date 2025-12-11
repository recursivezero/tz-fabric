import os
from pathlib import Path

PROJECT_DIR = Path(__file__).parent
ASSETS = PROJECT_DIR / "assets"
IMAGE_DIR = ASSETS / "images"
AUDIO_DIR = ASSETS / "audios"
GENERATED_IMAGE_FOLDER = ASSETS / "generated"
GROUP_IMAGE_FOLDER = ASSETS / "uploaded" / "group"
SINGLE_IMAGE_FOLDER = ASSETS / "uploaded" / "single"
CACHE_DIR = Path.home() / ".cache" / "tz_script"
API_PREFIX = "/api/v1"
MCP_URL = "http://localhost:8000/mcp/sse?transport=sse"

ENVIRONMENT = "development"
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "avif", "bmp"}
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

MODELS = {
    "best.pt": {
        "source": "github",
        "api_url": "https://api.github.com/repos/recursivezero/tz-script/releases/tags/v3.5.0",
    },
}

FABRIC_COLLECTION = "fabric_data"
PROCESSING_TIMES_COLLECTION = "fabric_log"
