import os
from pathlib import Path

from utils.env_config import load_env


load_env()
ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif", "bmp"]
TABLE_NAME = "tz-fabric-table"
PROJECT_DIR = Path(__file__).parent
STORAGE_OPTIONS = {}
RELATIVE_GENERATED_FOLDER = "s3://threadzip-bucket/uploaded/"
ASSETS = PROJECT_DIR / "assets"
UPLOAD_FOLDER_FABRIC = ASSETS / "search"
IMAGE_DIR = ASSETS / "images"
AUDIO_DIR = ASSETS / "audios"
CACHE_DIR = Path.home() / ".cache" / "tz_script"
API_PREFIX = os.getenv("API_PREFIX", "/api/v1")
CDN_URL = os.getenv("CDN_URL")
MCP_URL = "http://localhost:8000/mcp/sse?transport=sse"
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
print(f"Running in {ENVIRONMENT} environment")
IS_PROD = ENVIRONMENT == "production"
print(IS_PROD)
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "avif", "bmp"}
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

MODELS = {
    "best.pt": {
        "source": "github",
        "api_url": "https://api.github.com/repos/recursivezero/tz-script/releases/tags/v3.5.0",
    },
}
DATABASE_PATH = str(PROJECT_DIR / "database")
FABRIC_COLLECTION = "fabric_data"
PROCESSING_TIMES_COLLECTION = "fabric_log"

REQUIRED_DIRS = [
    ASSETS,
    IMAGE_DIR,
    AUDIO_DIR,
    CACHE_DIR,
    UPLOAD_FOLDER_FABRIC,
]


def ensure_directories():
    for path in REQUIRED_DIRS:
        try:
            path.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            raise RuntimeError(f"Cannot create directory: {path}") from e


ensure_directories()
MCP_URL = "http://localhost:8002/mcp/sse?transport=sse"
