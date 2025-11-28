import threading
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

from services.generate_response import analyse_fabric_image
from utils.cache import generate_cache_key, store_response
from utils.image_utils import convert_image_to_base64
from utils.prompt_generator import generate_prompts

executor = ThreadPoolExecutor(max_workers=6)


def process_remaining_prompts(prompts, image_base_64, cache_key, already_stored_idx):
    print(f"Processing remaining prompts for cache={cache_key}, skipping idx={already_stored_idx}")
    futures = {
        executor.submit(analyse_fabric_image, image_base_64, prompt, idx + 1): idx + 1
        for idx, prompt in enumerate(prompts)
        if idx + 1 != already_stored_idx
    }

    for future in as_completed(futures):
        idx = futures[future]
        try:
            result = future.result()
            response_text = result.get("response") if result else None
            store_response(cache_key, idx, {"id": idx, "response": response_text})
            print(f"Background stored index={idx}, response={response_text[:30] if response_text else 'None'}")

        except Exception as e:
            print(f" Exception in background prompt idx={idx}: {e}")
            store_response(cache_key, idx, {"id": idx, "response": None})


def analyse_all_variations(image, analysis_type):
    print("🧵 Starting analysis with threads...")

    prompts = generate_prompts(analysis_type)

    cache_key = str(uuid.uuid4())
    generate_cache_key(cache_key)

    image_base64 = convert_image_to_base64(image)
    if not image_base64:
        print("Failed to convert image to base64.")
        return {"cache_key": cache_key, "first": None}

    print("Image converted to base64 (length):", len(image_base64))

    futures = {}
    for idx, prompt in enumerate(prompts):
        print(f"[Thread] Prompt {idx + 1}:", prompt[:50])
        future = executor.submit(analyse_fabric_image, image_base64, prompt, idx + 1)
        futures[future] = idx + 1

    first_response = None

    for future in as_completed(futures):
        idx = futures[future]
        try:
            result = future.result()
            print(f"Future result for idx {idx}:", result)

            if not result:
                print(f"Empty result for idx {idx}")
                continue

            response_id = result.get("id")
            response_text = result.get("response")

            print(f"Parsed → id: {response_id}, response_text: {response_text[:40] if response_text else 'None'}")

            try:
                store_response(
                    cache_key,
                    response_id,
                    {"id": response_id, "response": response_text},
                )
                print(f"Stored response for index {response_id}")
            except Exception as e:
                print(f" Failed to store response {response_id}:", e)

            if not first_response:
                first_response = {"id": response_id, "response": response_text}
                print(" First response set:", first_response)
                break

        except Exception as e:
            print(f"Exception in future for idx {idx}:", e)
            try:
                store_response(cache_key, idx, {"id": idx, "response": None})
            except Exception as e:
                print(f" Failed to store fallback None for idx {idx}:", e)

            if not first_response:
                first_response = {"id": idx, "response": None}
                break

    if not first_response or "id" not in first_response:
        print("ERROR: Invalid or missing first_response:", first_response)
        return {"cache_key": cache_key, "first": {"id": 1, "response": None}}

    try:
        threading.Thread(
            target=process_remaining_prompts,
            args=(prompts, image_base64, cache_key, first_response["id"]),
            daemon=True,
        ).start()
        print(" Background thread started.")
    except Exception as e:
        print("Failed to start background thread:", e)

    print(" Returning from analyse_all_variations with:", first_response)

    return {"cache_key": cache_key, "first": first_response}
