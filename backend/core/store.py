import numpy as np
from typing import List, Dict, Tuple
from core.indexer import build_index

V: np.ndarray | None = None
METAS: List[Dict] | None = None

def ensure_index():
    global V, METAS
    if V is None or METAS is None:
        V, METAS = build_index()

def get_index() -> Tuple[np.ndarray, List[Dict]]:
    ensure_index()
    # type: ignore
    return V, METAS

def reindex() -> Tuple[int, int]:
    global V, METAS
    V, METAS = build_index()
    return V.shape[0], len(METAS)