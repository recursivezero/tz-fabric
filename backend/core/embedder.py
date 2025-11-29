import io
from typing import Any, List

import numpy as np
from PIL import Image


# Explicit annotation so mypy knows this name may hold different runtime types.
Resampling: Any
try:
    Resampling = Image.Resampling  # type: ignore[attr-defined]
except AttributeError:

    class _ResamplingFallback:
        # use getattr so mypy doesn't complain when PIL stubs don't define these attributes
        BILINEAR = getattr(Image, "BILINEAR")
        LANCZOS = getattr(Image, "LANCZOS")

    Resampling = _ResamplingFallback  # type: ignore[assignment]


def _rgb_hist(img_rgb: Image.Image, bins: int = 8) -> np.ndarray:
    arr = np.asarray(img_rgb, dtype=np.uint8)
    feats = []
    for c in range(3):
        hist, _ = np.histogram(arr[..., c], bins=bins, range=(0, 256))
        feats.append(hist.astype(np.float32))
    return np.concatenate(feats, axis=0)


def _gray_thumbnail(img_rgb: Image.Image, size: int = 16) -> np.ndarray:
    gray = img_rgb.convert("L").resize((size, size), resample=Resampling.BILINEAR)
    arr = np.asarray(gray, dtype=np.float32)
    return arr.flatten()


def embed_image_bytes(b: bytes) -> List[float]:
    img = Image.open(io.BytesIO(b)).convert("RGB")

    g = _gray_thumbnail(img)
    h = _rgb_hist(img)
    vec = np.concatenate([g, h]).astype(np.float32)  # (280,)

    n = np.linalg.norm(vec) + 1e-8
    return (vec / n).astype(np.float32).tolist()
