# tools/search_tool.py
import base64
import os
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from core.embedder import embed_image_bytes
from core.search import topk_search
from core.store import get_index
from utils.paths import build_image_url, build_audio_url

ISO_FORMATS = (
    "%Y-%m-%dT%H:%M:%S.%fZ",
    "%Y-%m-%dT%H:%M:%S.%f%z",
    "%Y-%m-%dT%H:%M:%S.%f",
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%dT%H:%M:%S",
)


def _to_ts(dt: datetime) -> float:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def _parse_any_iso(s: str) -> float:
    s = (s or "").strip()
    if not s:
        return 0.0
    for fmt in ISO_FORMATS:
        try:
            return _to_ts(datetime.strptime(s, fmt))
        except Exception:
            pass
    try:
        return _to_ts(datetime.fromisoformat(s.replace("Z", "+00:00")))
    except Exception:
        return 0.0


def _extract_ts_from_name(name: str) -> float:
    if not name:
        return 0.0
    # ISO-like: 2023-08-15T12:00:00
    iso_match = re.search(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", name)
    if iso_match:
        try:
            return _to_ts(datetime.fromisoformat(iso_match.group(0)))
        except Exception:
            pass
    ymd = re.search(r"(19|20)\d{2}\d{2}\d{2}(?:\d{6})?", name)
    if ymd:
        s = ymd.group(0)
        try:
            if len(s) >= 14:
                dt = datetime.strptime(s[:14], "%Y%m%d%H%M%S")
            elif len(s) == 8:
                dt = datetime.strptime(s, "%Y%m%d")
            else:
                return 0.0
            return _to_ts(dt)
        except Exception:
            pass
    # YYYY-MM-DD
    ymd2 = re.search(r"(19|20)\d{2}-\d{2}-\d{2}", name)
    if ymd2:
        try:
            return _to_ts(datetime.fromisoformat(ymd2.group(0)))
        except Exception:
            pass
    return 0.0


def _created_ts(meta: dict) -> float:
    if not meta:
        return 0.0
    for key in ("createdAt", "created_at", "timestamp"):
        if key in meta:
            val = meta[key]
            if isinstance(val, (int, float)):
                return float(val)
            if isinstance(val, str):
                ts = _parse_any_iso(val)
                if ts:
                    return ts

    abs_path = meta.get("absPath")
    if abs_path and os.path.exists(abs_path):
        try:
            return os.path.getmtime(abs_path)
        except Exception:
            pass

    rel = meta.get("relPath") or meta.get("fileName") or meta.get("name") or ""
    ts = _extract_ts_from_name(rel)
    if ts:
        return ts

    return 0.0


def search_tool(
    *,
    image_b64: Optional[str] = None,
    image_path: Optional[str] = None,
    image_bytes: Optional[bytes] = None,
    k: int = 1,
    order: str = "recent",  # "recent" or "score"
    debug_ts: bool = False,
    min_sim: float = 0.5,
    require_audio: bool = True,
) -> Dict[str, Any]:
    # Resolve image bytes
    if image_b64 and not image_bytes:
        try:
            image_bytes = base64.b64decode(image_b64)
        except Exception as e:
            raise ValueError(f"image_b64 decode failed: {e}")

    if image_path and not image_bytes:
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"image_path not found: {image_path}")
        with open(image_path, "rb") as f:
            image_bytes = f.read()

    if not image_bytes:
        raise ValueError("No image provided. Provide image_b64 or image_path or image_bytes.")

    # Embed
    embedding = embed_image_bytes(image_bytes)

    # Query collection
    collection = get_index()
    pool_k = max(int(k) * 30, 300)
    results = topk_search(collection, embedding, int(pool_k))

    metadatas = results.get("metadatas", [[]])[0]
    similarities = results.get("similarities", [[]])[0]

    items: List[Dict[str, Any]] = []
    for meta, sim in zip(metadatas, similarities):
        if sim < float(min_sim):
            continue

        image_fn = meta.get("imageFilename")
        audio_fn = meta.get("audioFilename")

        # attach accessible URLs (may be None)
        meta["imageUrl"] = build_image_url(image_fn) if image_fn else None
        meta["audioUrl"] = build_audio_url(audio_fn) if audio_fn else None

        if bool(require_audio) and not audio_fn:
            continue

        if bool(debug_ts):
            meta["_ts"] = _created_ts(meta)

        items.append({"score": float(sim), "metadata": meta})

    # sort
    if order == "recent":
        items.sort(key=lambda it: (it["score"], _created_ts(it["metadata"])), reverse=True)
    else:
        items.sort(key=lambda it: it["score"], reverse=True)

    # truncate
    items = items[: int(k)]

    return {"count": len(items), "results": items}
