import os
from pathlib import Path

from utils.env_config import init_env

init_env()
# env variables
API_PREFIX = os.getenv("API_PREFIX", "/api/v1")
CDN_URL = os.getenv("AWS_PUBLIC_URL", "https://cdn.threadzip.com")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
API_KEY = os.getenv("INTERNAL_API_KEY", "abcd1234")
BUCKET_NAME = os.getenv("AWS_BUCKET_NAME")

IS_PROD = ENVIRONMENT == "production"
IS_DEV = ENVIRONMENT == "development"


PROJECT_DIR = Path(__file__).parent
RELATIVE_GENERATED_FOLDER = f"s3://{BUCKET_NAME}/images/"
ASSETS = PROJECT_DIR / "assets"
UPLOAD_FOLDER_FABRIC = ASSETS / "search"
IMAGE_DIR = ASSETS / "images"
AUDIO_DIR = ASSETS / "audios"
CACHE_DIR = Path.home() / ".cache" / "tz_script"

TABLE_NAME = "tz-fabric-table"
MCP_URL = "http://localhost:8002/mcp/sse?transport=sse"
ALLOWED_EXTENSIONS: set[str] = {"jpg", "jpeg", "png", "webp", "avif", "bmp"}


print(f"Running in {ENVIRONMENT} environment")

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
