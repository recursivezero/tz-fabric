# vector_search.py
import time
from typing import Any, List, Tuple


def run_vector_search(
    table, schema, search_query: Any, limit: int = 6, category: List | None = None
) -> Tuple[List[Any], List[str]]:
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

    query = table.search(search_query)

    if category:
        query = query.where(where_clause, prefilter=True)

    rs = query.limit(limit).to_pydantic(schema)

    # Process results with optimized path handling
    image_uris = []
    image_paths = []

    for result in rs:
        if hasattr(result, "image_uri"):
            image_uris.append(result.image_uri)
            # Optimized path processing
            full_path = result.image_uri.replace("\\", "/")
            parts = full_path.rsplit("/", 2)
            if len(parts) >= 2:
                image_paths.append(f"{parts[-2]}/{parts[-1]}")

    # Debug timing (comment out in production)
    search_time = time.perf_counter() - start_time
    print(f"Vector search executed in {search_time:.2f}s")

    return image_uris, image_paths
