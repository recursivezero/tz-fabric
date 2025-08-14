import time
from pathlib import Path
from typing import List, Dict, Tuple
import numpy as np
from PIL import Image

from constants import IMG_DIR, AUD_DIR
from core.embedder import embed_image_bytes

def _find_audio_for(stem: str) -> str | None:
    for p in AUD_DIR.glob("*"):
        if p.is_file() and p.stem == stem:
            return f"/api/assets/audios/{p.name}"
    return None

def build_index() -> Tuple[np.ndarray, List[Dict]]:
    vectors = []
    metas: List[Dict] = []

    for img_path in sorted(IMG_DIR.glob("*")):
        if not img_path.is_file():
            continue
        try:
            b = img_path.read_bytes()
            vec = embed_image_bytes(b)   # (280,) normalized
            vectors.append(vec)

            created = time.strftime(
                "%Y-%m-%dT%H:%M:%S",
                time.localtime(img_path.stat().st_mtime)
            )
            metas.append({
                "imageUrl": f"/api/assets/images/{img_path.name}",
                "audioUrl": _find_audio_for(img_path.stem),
                "createdAt": created,
            })
            print("Indexed:", img_path.name)
        except Exception as e:
            print("Skip:", img_path.name, "->", e)

    if not vectors:
        return np.zeros((0, 280), dtype=np.float32), []

    V = np.stack(vectors, axis=0).astype(np.float32)  # (N,280)
    return V, metas