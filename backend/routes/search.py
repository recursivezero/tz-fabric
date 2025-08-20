from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
from typing import List
from datetime import datetime, timezone
import os
import re

from core.embedder import embed_image_bytes
from core.search import topk_search
from core.store import get_index

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
    debug_ts: bool = Query(False, description="Include computed _ts in metadata for debugging")
):
    try:
        embedding = embed_image_bytes(await file.read())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file.")

    collection = get_index()

    results = topk_search(collection, embedding, k)

    metadatas = results.get("metadatas", [[]])[0]
    similarities = results.get("similarities", [[]])[0]  # <-- use exact similarities

    items: List[SearchItem] = []
    for meta, sim in zip(metadatas, similarities):
        ts = _created_ts(meta)
        if debug_ts:
            meta["_ts"] = ts
        # sim is already cosine similarity [0.0–1.0], exact = 1.000
        items.append(SearchItem(score=sim, metadata=meta))

    if order == "recent":
        items.sort(key=lambda it: (_created_ts(it.metadata), it.score), reverse=True)
    else:
        items.sort(key=lambda it: it.score, reverse=True)

    return SearchResponse(count=len(items), results=items)

