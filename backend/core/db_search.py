# core/search.py
from datetime import datetime
from typing import Any, Mapping, Sequence, cast

from chromadb.api.models.Collection import Collection


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

    # Chromadb's typing for query_embeddings is a bit strict; cast to an accepted type.
    query_embeddings = cast(
        list[Sequence[float] | Sequence[int]],  # acceptable by chromadb stubs
        [embedding],
    )

    # Chromadb's return type is complex; cast to a dict so mypy knows it's indexable.
    res = cast(
        dict[str, Any],
        collection.query(
            query_embeddings=query_embeddings,
            n_results=topN,
            include=["metadatas", "distances"],
        ),
    )

    # Each field is expected to be a list-of-list; cast accordingly before indexing.
    ids = cast(list[list[Any]], res["ids"])[0]
    metas = cast(list[list[Mapping[str, Any]]], res.get("metadatas", [[]]))[0]
    dists = cast(list[list[float]], res.get("distances", [[]]))[0]

    items = []
    for i in range(len(ids)):
        meta = metas[i]
        dist = float(dists[i])

        # meta.get(...) can be many types; normalize to str or None for _ts
        created_val = meta.get("createdAt")
        created_ts = _ts(str(created_val) if created_val is not None else None)

        items.append((dist, created_ts, ids[i], meta))

    items.sort(key=lambda x: (x[0], -x[1]))
    items = items[:k]

    return {
        "ids": [[it[2] for it in items]],
        "metadatas": [[it[3] for it in items]],
        "distances": [[it[0] for it in items]],
        "similarities": [[round(1.0 - it[0], 3) for it in items]],
    }
