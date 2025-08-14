import numpy as np
from typing import List, Tuple

def topk_cosine(query_vec: np.ndarray, V: np.ndarray, k: int = 200) -> List[Tuple[int, float]]:
    if V is None or len(V) == 0:
        return []
    s = V @ query_vec  # (N,) scores
    k = min(k, len(s))
    idx = np.argpartition(-s, k-1)[:k]     
    idx = idx[np.argsort(-s[idx])]         
    return [(int(i), float(s[i])) for i in idx]