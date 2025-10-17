# routes_validate.py
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse
from utils.gemini_client import gemini_vision_check
from PIL import Image
import io, hashlib, asyncio, time
from functools import lru_cache

router = APIRouter()

VALIDATION_PROMPT = """
Accept only if:
- Fabric texture, weave, or material is clearly visible and fills the image.
- Image is a close-up of fabric only.

Reject if:
- Contains people, mannequins, body parts
- Clothing being worn
- Shoes, bags, curtains with rods, or any full object
- Backgrounds, furniture, rooms, scenes
- Fabric is blurry or too distant

### Respond with exactly:
"Valid fabric image" OR "Invalid image: [reason]"
"""

MAX_SIDE = 1024
JPEG_QUALITY = 80
GEMINI_TIMEOUT_SEC = 15

def _sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

@lru_cache(maxsize=1024)
def _cached_verdict(img_hash: str) -> str:
    """LRU cache to store 'Valid' or 'Invalid' verdicts."""
    return ""

def _resize_to_jpeg(data: bytes) -> bytes:
    with Image.open(io.BytesIO(data)) as im:
        im = im.convert("RGB")
        w, h = im.size
        if max(w, h) > MAX_SIDE:
            if w >= h:
                nw = MAX_SIDE
                nh = int(h * (MAX_SIDE / w))
            else:
                nh = MAX_SIDE
                nw = int(w * (MAX_SIDE / h))
            im = im.resize((nw, nh), Image.LANCZOS)
        out = io.BytesIO()
        im.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
        return out.getvalue()

async def _gemini_check_base64(b64_str: str) -> str:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, gemini_vision_check, b64_str, VALIDATION_PROMPT)

def _to_b64(data: bytes) -> str:
    import base64
    return base64.b64encode(data).decode("ascii")

@router.post("/validate-image")
async def validate_image(image: UploadFile = File(...)):
    t0 = time.time()
    try:
        raw = await image.read()
        t1 = time.time()

        img_hash = _sha256(raw)

        # LRU cache hit
        cached = _cached_verdict(img_hash)
        if cached:
            print(f"[validate-image] cache-hit={cached} total={(time.time()-t0)*1000:.0f}ms")
            return JSONResponse(content={"valid": cached == "Valid"})

        # Resize off main loop
        small_jpeg = await asyncio.to_thread(_resize_to_jpeg, raw)
        t2 = time.time()

        b64 = _to_b64(small_jpeg)

        # Gemini call with timeout
        try:
            response = await asyncio.wait_for(_gemini_check_base64(b64), timeout=GEMINI_TIMEOUT_SEC)
        except asyncio.TimeoutError:
            print(f"[validate-image] timeout total={(time.time()-t0)*1000:.0f}ms")
            return JSONResponse(status_code=504, content={"valid": False, "reason": "Validation timed out"})
        t3 = time.time()

        # Decide verdict
        verdict = "Invalid" if "Invalid image" in (response or "") else "Valid"

        # Store in cache
        _cached_verdict.cache_clear()   # remove old
        _cached_verdict(img_hash)       # repopulate
        _cached_verdict.__wrapped__     # needed for lru_cache direct call
        _cached_verdict(img_hash)       # ensure it sticks

        print(f"[validate-image] read={(t1-t0)*1000:.0f}ms resize={(t2-t1)*1000:.0f}ms gemini={(t3-t2)*1000:.0f}ms total={(t3-t0)*1000:.0f}ms verdict={verdict}")

        return JSONResponse(content={"valid": verdict == "Valid"})

    except Exception as e:
        print("Validation error:", e)
        return JSONResponse(status_code=500, content={"valid": False, "error": str(e)})
