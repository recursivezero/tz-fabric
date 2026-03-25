import time

import lancedb
from utils.logger import logThis


class TTLCache:
    def __init__(self, ttl=180):
        self.ttl = ttl
        self.cache = {}

    def get(self, key):
        if key not in self.cache:
            return None

        value, timestamp = self.cache[key]
        if time.time() - timestamp > self.ttl:
            del self.cache[key]
            return None

        return value

    def put(self, key, value):
        self.cache[key] = (value, time.time())


# Create cache instances
_db_cache = TTLCache(ttl=180)
_table_cache = TTLCache(ttl=180)


def get_db_connection(database: str) -> lancedb.DBConnection:
    """Get cached database connection with 3-minute expiry"""
    cached = _db_cache.get(database)
    if cached:
        return cached

    connection = lancedb.connect(database)
    _db_cache.put(database, connection)
    return connection


def get_table(database: str, table_name: str, max_retries=5, delay=0.5):
    """Fetch table from LanceDB with S3 retry handling and caching."""
    key = f"{database}:{table_name}"
    cached = _table_cache.get(key)
    if cached:
        return cached

    db = get_db_connection(database)

    for i in range(max_retries):
        try:
            table = db.open_table(table_name)
            _table_cache.put(key, table)
            return table
        except Exception as e:
            logThis.warning(f"Attempt {i + 1}: Table not ready yet: {e}")
            time.sleep(delay)

    raise RuntimeError(f"Failed to load table {table_name} after {max_retries} retries")


def warm_up_table_model(table):
    try:
        _ = table.search("warmup").limit(1).to_list()
        logThis.info("Table  warmed up")
    except Exception as e:
        logThis.info(f"Model warm-up failed: {e}")
