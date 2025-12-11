"""Model Manager Utility

This module handles downloading and caching of model files from various sources including
private GitHub repositories.
"""

from pathlib import Path

from huggingface_hub import hf_hub_download
import requests
from image_detection.logger import logThis
from constants import CACHE_DIR, GITHUB_TOKEN, MODELS


class ModelManager:
    def __init__(self):
        """Initialize the model manager with cache directory setup."""
        self.cache_dir = CACHE_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.headers = (
            {
                "Authorization": f"token {GITHUB_TOKEN}",
                "User-Agent": "python-requests/model-downloader",
            }
            if GITHUB_TOKEN
            else {}
        )

    def download_model(self, name: str) -> Path:
        """Ensure the model file is available locally and return its path."""
        if name not in MODELS:
            raise ValueError(f"Unknown model: {name}")
        model_info = MODELS[name]
        model_path = self.cache_dir / name

        if model_info["source"] == "hf":
            logThis.info(
                f"Fetching {name} from Hugging Face Hub ({model_info['repo']})…"
            )
            path = Path(
                hf_hub_download(
                    repo_id=model_info["repo"],
                    filename=name,
                )
            )
            logThis.info(f"✔ {name} available at {path}")
            return path

        elif model_info["source"] == "github":
            api_url = model_info["api_url"]
            filename = name

            if not model_path.exists():
                logThis.info(f"⬇ Downloading {filename} from GitHub release...")

                try:

                    logThis.info(f"Getting release info from API: {api_url}")
                    api_response = requests.get(api_url, headers=self.headers)
                    api_response.raise_for_status()
                    release_data = api_response.json()

                    # Step 1: Find the asset by filename
                    target_asset = next(
                        (
                            a
                            for a in release_data.get("assets", [])
                            if a["name"] == filename
                        ),
                        None,
                    )
                    if not target_asset:
                        raise ValueError(f"Asset '{filename}' not found in release")

                    logThis.info(
                        f"Found asset: {target_asset['name']} ({target_asset['size']} bytes)"
                    )

                    # Step 2: Download the asset using asset API
                    download_headers = self.headers.copy()
                    download_headers["Accept"] = "application/octet-stream"

                    logThis.info(f"Downloading from asset API: {target_asset['url']}")
                    with requests.get(
                        target_asset["url"],
                        headers=download_headers,
                        stream=True,
                        timeout=60,
                    ) as r:
                        r.raise_for_status()

                        # Step 3: Write file in chunks
                        with open(model_path, "wb") as f:
                            for chunk in r.iter_content(chunk_size=8192):
                                if chunk:
                                    f.write(chunk)

                    # Step 4: Verify file
                    if model_path.stat().st_size == 0:
                        model_path.unlink()
                        raise RuntimeError(f"Downloaded file {filename} is empty")

                    logThis.info(
                        f"✔ Download complete, cached at {model_path} ({model_path.stat().st_size} bytes)"
                    )

                except requests.HTTPError as e:
                    logThis.error(f"❌ Failed to fetch {filename}: {e}")
                    raise
                except requests.RequestException as e:
                    logThis.error(f"❌ Request failed for {filename}: {e}")
                    raise

            else:
                logThis.info(f"✔ {filename} already cached at {model_path}")

            return model_path

    def get_model_path(self, name: str, required: bool = True) -> Path:
        """Get path to a model file, downloading it if necessary.

        Args:
            url: The URL to download the model from if needed
            required: If True, raise an error when model can't be obtained

        Returns:
            Path to the model file

        Raises:
            RuntimeError: If required is True and model couldn't be obtained
        """
        model_path = self.download_model(name)

        if model_path is None and required:
            raise RuntimeError("Failed to obtain required model from. ")

        return model_path

    def download_all(self):
        """Download all known models."""

        for name in MODELS:
            try:
                path = self.get_model_path(name)
                logThis.info(f"✔ {name} available at {path}")
            except Exception as e:
                logThis.error(f"❌ Failed to download {name}: {e}")


if __name__ == "__main__":
    ModelManager.download_all()
