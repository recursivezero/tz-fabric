import threading
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

from services.generate_response import analyse_fabric_image
from utils.cache import generate_cache_key, store_response
from utils.image_utils import convert_image_to_base64
from utils.prompt_generator import generate_prompts

executor = ThreadPoolExecutor(max_workers=2)


def process_remaining_prompts(prompts, image_base_64, cache_key, already_stored_idx):
    print(
        f"Processing remaining prompts for cache={cache_key}, skipping idx={already_stored_idx}"
    )
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
            if not response_text:
                # analyse_fabric_image should now fallback, but keep cache safe.
                response_text = "Fabric analysis is temporarily unavailable for this variation. Please try again."
            store_response(cache_key, idx, {"id": idx, "response": response_text})
            print(
                f"Background stored index={idx}, response={response_text[:30] if response_text else 'None'}"
            )

        except Exception as e:
            print(f" Exception in background prompt idx={idx}: {e}")
            store_response(
                cache_key,
                idx,
                {
                    "id": idx,
                    "response": "Fabric analysis is temporarily unavailable for this variation. Please try again.",
                },
            )


def analyse_all_variations(image, analysis_type):
    print("🧵 Starting analysis with fast first response...")

    analysis_type = (analysis_type or "short").strip().lower()
    if analysis_type not in {"short", "long"}:
        analysis_type = "short"

    prompts = generate_prompts(analysis_type)

    cache_key = str(uuid.uuid4())
    generate_cache_key(cache_key)

    image_base64 = convert_image_to_base64(image)
    if not image_base64:
        print("Failed to convert image to base64.")
        fallback_text = "The uploaded image could not be prepared for analysis. Please try a different image file."
        first = {"id": 1, "response": fallback_text}
        store_response(cache_key, 1, first)
        return {"cache_key": cache_key, "first": first}

    print("Image converted to base64 (length):", len(image_base64))

    # Do NOT fire all six Groq requests before returning. The old flow submitted
    # every variation, returned the first completed one, and then started another
    # background job for the remaining variations. That duplicated requests,
    # overloaded the backend, and made normal uploads feel very slow.
    first_response = None
    for idx, prompt in enumerate(prompts[:2], start=1):
        try:
            print(f"[Fast First] Prompt {idx}:", prompt[:50])
            result = analyse_fabric_image(image_base64, prompt, idx)
            response_text = result.get("response") if result else None
            if not response_text:
                continue
            first_response = {"id": idx, "response": response_text}
            store_response(cache_key, idx, first_response)
            break
        except Exception as e:
            print(f"Exception while getting first analysis response idx={idx}:", e)
            # Keep trying the next prompt; analyse_fabric_image already has a
            # local fallback, so this is just an extra safety net.
            try:
                store_response(cache_key, idx, {"id": idx, "response": None})
            except Exception as store_error:
                print(f"Failed to store empty response idx={idx}:", store_error)

    if not first_response or "id" not in first_response:
        print("ERROR: Invalid or missing first_response:", first_response)
        result = analyse_fabric_image(image_base64, prompts[0], 1)
        response_text = result.get("response") if result else None
        if not response_text:
            response_text = "The fabric image is visible, but the analyzer could not generate a detailed response. Please try again."
        first_response = {"id": 1, "response": response_text}
        store_response(cache_key, 1, first_response)

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
