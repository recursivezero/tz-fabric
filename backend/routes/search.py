from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
from typing import List
from datetime import datetime, timezone
import os

from core.embedder import embed_image_bytes
from core.search import topk_search
from core.store import get_index
from utils.paths import build_image_url, build_audio_url

router = APIRouter(tags=["search"])


class SearchItem(BaseModel):
    score: float
    metadata: dict


class SearchResponse(BaseModel):
    count: int
    results: List[SearchItem]


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
    s = s.strip()
    for fmt in ISO_FORMATS:
        try:
            return _to_ts(datetime.strptime(s, fmt))
        except Exception:
            pass
    try:
        return _to_ts(datetime.fromisoformat(s.replace("Z", "+00:00")))
    except Exception:
        return 0.0


def _created_ts(meta: dict) -> float:
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


@router.post("/search", response_model=SearchResponse)
async def search_similar(
    file: UploadFile = File(...),
    k: int = Query(1, ge=1, le=300),
    order: str = Query("recent", pattern="^(recent|score)$"),
    debug_ts: bool = Query(
        False, description="Include computed _ts in metadata for debugging"
    ),
    min_sim: float = Query(0.5, ge=0.0, le=1.0),
    require_audio: bool = Query(True),
):
    try:
        embedding = embed_image_bytes(await file.read())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file.")

    collection = get_index()

    pool_k = max(k * 30, 300)
    results = topk_search(collection, embedding, pool_k)

    metadatas = results.get("metadatas", [[]])[0]
    similarities = results.get("similarities", [[]])[0]

    items: List[SearchItem] = []
    for meta, sim in zip(metadatas, similarities):
        if sim < min_sim:
            continue

        image_fn = meta.get("imageFilename")
        audio_fn = meta.get("audioFilename")

        meta["imageUrl"] = build_image_url(image_fn)
        meta["audioUrl"] = build_audio_url(audio_fn)

        if require_audio and not audio_fn:
            continue

        ts = _created_ts(meta)
        if debug_ts:
            meta["_ts"] = ts

        items.append(SearchItem(score=sim, metadata=meta))

    if order == "recent":
        items.sort(key=lambda it: (it.score, _created_ts(it.metadata)), reverse=True)
    else:
        items.sort(key=lambda it: it.score, reverse=True)

    items = items[:k]

    return SearchResponse(count=len(items), results=items)
