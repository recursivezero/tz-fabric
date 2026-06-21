# vector_search.py
import time
from typing import Any, List, Optional, Tuple


def _display_image_path(image_uri: Optional[str]) -> Optional[str]:
    if not image_uri:
        return None

    full_path = str(image_uri).replace("\\", "/")

    # Do not strip CDN URLs. The browser can display these directly.
    if full_path.startswith(("http://", "https://")):
        return full_path

    parts = full_path.split("/")
    for root in ("product", "fabric", "stock", "design", "single", "group"):
        if root in parts:
            idx = parts.index(root)
            return "/".join(parts[idx:])

    return "/".join(parts[-2:])


def run_vector_search(
    table, schema, search_query: Any, limit: int = 6, category: List = []
) -> Tuple[List[Any], List[str]]:
    print(category)
    """Optimized vector search with same interface but faster performance.

    Args:
        database (str): Path to the LanceDB database.
        table_name (str): Name of the table to search.
        schema: Pydantic schema of the table.
        search_query (Any): The search query (text, PIL.Image, or image path).
        limit (int, optional): Maximum number of results. Defaults to 6.
        category (str | None, optional): The category to filter by. Defaults to None.

    Returns:
        Tuple[List[Any], List[str]]: (image_uris, formatted_image_paths)
    """
    # Start timing
    start_time = time.perf_counter()

    # Perform the vector search
    where_clause = " OR ".join(f"tag == '{c}'" for c in (category or []))
    print("WHERE CLAUSE:", where_clause)
    query = table.search(search_query)
    print(f"Initial search query constructed: {query}")  # Debug log

    if category:
        query = query.where(where_clause, prefilter=True)

    rs = query.limit(limit).to_pydantic(schema)

    # Process results with optimized path handling
    image_uris = []
    image_paths = []

    for result in rs:
        if hasattr(result, "image_uri"):
            image_uris.append(result.image_uri)
            display_path = _display_image_path(result.image_uri)
            if display_path:
                image_paths.append(display_path)

    # Debug timing (comment out in production)
    search_time = time.perf_counter() - start_time
    print(f"Vector search executed in {search_time:.2f}s")
    return image_uris, image_paths
