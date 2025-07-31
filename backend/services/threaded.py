import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from services.generate_response import analyse_fabric_image
from utils.image_utils import convert_image_to_base64
from utils.prompt_generator import generate_prompts
from utils.cache import generate_cache_key, store_response

executor = ThreadPoolExecutor(max_workers=6)

def analyse_all_variations(image, analysis_type):
    print("🧵 Starting analysis with threads...")

    prompts = generate_prompts(analysis_type)
    cache_key = str(uuid.uuid4())
    generate_cache_key(cache_key)

    image_base64 = convert_image_to_base64(image)
    if not image_base64:
        print("Failed to convert image to base64.")
        return [{"id": i+1, "response": None} for i in range(6)]

    futures = {}
    for idx, prompt in enumerate(prompts):
        future = executor.submit(analyse_fabric_image, image_base64, prompt)
        futures[future] = idx + 1

    first_response = None
    for future in as_completed(futures):
        idx = futures[future]
        try:
            result = future.result()
            response_text = result.get("response") if result else None
            store_response(cache_key, idx, {"id": idx, "response": response_text})

            if not first_response:
                first_response = {"id": idx, "response": response_text}
        except Exception as e:
            store_response(cache_key, idx, {"id": idx, "response": None})

    return {"cache_key": cache_key, "first": first_response}

