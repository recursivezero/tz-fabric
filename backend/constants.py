from pathlib import Path

PROJECT_DIR = Path(__file__).parent
ASSETS = PROJECT_DIR / "assets"
IMAGE_DIR = ASSETS / "images"
AUDIO_DIR = ASSETS / "audios"

API_PREFIX = "/api/v1"
MCP_URL = "http://localhost:8000/mcp/sse?transport=sse"
