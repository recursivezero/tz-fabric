import threading

response_cache = {}
cache_lock = threading.Lock()


def store_response(cache_key, index, response):
    with cache_lock:
        if cache_key not in response_cache:
            response_cache[cache_key] = {}
        response_cache[cache_key][index] = response


def get_response(cache_key, index):
    with cache_lock:
        return response_cache.get(cache_key, {}).get(index)


def generate_cache_key(cache_key):
    with cache_lock:
        response_cache[cache_key] = {}
