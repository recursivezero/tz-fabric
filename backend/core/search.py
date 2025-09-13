# core/search.py
from chromadb.api.models.Collection import Collection
from typing import Any
from datetime import datetime


def _ts(iso: str | None) -> float:
    if not iso:
        return 0.0
    try:
        return datetime.fromisoformat(iso).timestamp()
    except Exception:
        return 0.0


def topk_search(
    collection: Collection, embedding: list[float], k: int = 10
) -> dict[str, Any]:
    topN = min(max(k * 10, 100), 500)

    res = collection.query(
        query_embeddings=[embedding], n_results=topN, include=["metadatas", "distances"]
    )

    ids = res["ids"][0]
    metas = res.get("metadatas", [[]])[0]
    dists = res.get("distances", [[]])[0]

    items = []
    for i in range(len(ids)):
        meta = metas[i]
        dist = float(dists[i])
        created_ts = _ts(meta.get("createdAt"))
        items.append((dist, created_ts, ids[i], meta))

    items.sort(key=lambda x: (x[0], -x[1]))
    items = items[:k]

    return {
        "ids": [[it[2] for it in items]],
        "metadatas": [[it[3] for it in items]],
        "distances": [[it[0] for it in items]],
        "similarities": [[round(1.0 - it[0], 3) for it in items]],
    }
