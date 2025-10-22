# routes_validate.py (updated - robust JSON extraction & cache fix)
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse
from utils.gemini_client import gemini_vision_check
from PIL import Image, ExifTags
import io, hashlib, asyncio, time, json, re
from collections import OrderedDict

# Optional CV functions use opencv; install opencv-python-headless
try:
    import cv2
    import numpy as np
except Exception:
    cv2 = None
    np = None

router = APIRouter()

# ---------------- PROMPT ----------------
VALIDATION_PROMPT = """
You are an image validator. Accept only if BOTH:
1) Fabric texture, weave, or material is clearly visible and fills most of the image.
2) Image is a close-up of fabric only (no people, mannequins, body parts, worn clothing, large scenes).

Reject if:
- Contains people, mannequins, body parts or clothing being worn.
- Shows large background, furniture, scenes.
- Fabric is too distant (not a close-up) or very blurry.

Respond **only** with valid JSON exactly in this format (no commentary):

{
  "verdict": "valid" | "invalid",
  "reason": "<short reason>",
  "texture_visible": true | false,
  "texture_confidence": 0.0-1.0,
  "pattern_full_motif": true | false
}

Also: If "texture_visible" is true and "texture_confidence" >= 0.6, do not return a reason that contradicts that (e.g., "contains scene with multiple objects"); instead set "verdict":"valid" unless there are people/mannequins. Return JSON only.
"""

MAX_SIDE = 1024
JPEG_QUALITY = 80
GEMINI_TIMEOUT_SEC = 15

# ---------------- CACHE ----------------
_MAX_CACHE = 1024
_verdict_cache = OrderedDict()  # img_hash -> {"verdict","reason","meta"}

def _sha256(b: bytes) -> str:
    import hashlib
    return hashlib.sha256(b).hexdigest()

def _cache_get(img_hash: str):
    item = _verdict_cache.get(img_hash)
    if item:
        _verdict_cache.move_to_end(img_hash)
    return item

def _cache_set(img_hash: str, verdict_obj: dict):
    _verdict_cache[img_hash] = verdict_obj
    _verdict_cache.move_to_end(img_hash)
    while len(_verdict_cache) > _MAX_CACHE:
        _verdict_cache.popitem(last=False)

# If you need to flush a single cached image during debugging:
# _verdict_cache.pop(img_hash, None)

# ---------------- IMAGE UTIL ----------------
def _resize_to_jpeg(data: bytes) -> bytes:
    with Image.open(io.BytesIO(data)) as im:
        try:
            # handle EXIF orientation if present
            for orientation in ExifTags.TAGS.keys():
                if ExifTags.TAGS[orientation] == 'Orientation':
                    break
            exif = im._getexif()
            if exif is not None:
                orientation_value = exif.get(orientation)
                if orientation_value == 3:
                    im = im.rotate(180, expand=True)
                elif orientation_value == 6:
                    im = im.rotate(270, expand=True)
                elif orientation_value == 8:
                    im = im.rotate(90, expand=True)
        except Exception:
            pass

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

def _to_b64(data: bytes) -> str:
    import base64
    return base64.b64encode(data).decode("ascii")

async def _gemini_check_base64(b64_str: str) -> str:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, gemini_vision_check, b64_str, VALIDATION_PROMPT)

def _strip_code_fences(text: str) -> str:
    """Remove common Markdown code fences (```json ... ```), and surrounding backticks."""
    if text is None:
        return ""
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s*```$", "", t)
    t = t.strip("` \n\r\t")
    return t

def _extract_json_object_from_text(text: str):
    """
    Robustly find and return the first balanced JSON object substring (from '{' to matching '}').
    Returns None if not found.
    Handles extra text before/after and common code fences.
    """
    if not text:
        return None
    t = _strip_code_fences(text)

    idx = t.find("{")
    if idx == -1:
        return None

    depth = 0
    start = None
    for i in range(idx, len(t)):
        ch = t[i]
        if ch == "{":
            if start is None:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start is not None:
                candidate = t[start:i+1]
                return candidate
    # no balanced object found
    return None

def _texture_metrics_from_bytes(image_bytes: bytes, target_size=512):
    """
    Returns dict: {"lap_var": float, "edge_density": float, "patch_std_mean": float}
    Returns None if cv2 not available or decode fails.
    """
    if cv2 is None or np is None:
        return None
    try:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        im = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if im is None:
            return None

        h, w = im.shape[:2]
        scale = target_size / max(h, w) if max(h, w) > target_size else 1.0
        if scale != 1.0:
            im = cv2.resize(im, (int(w*scale), int(h*scale)), interpolation=cv2.INTER_AREA)

        gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)

        lap = cv2.Laplacian(gray, cv2.CV_64F)
        lap_var = float(lap.var())

        v = np.median(gray)
        lower = int(max(0, 0.66 * v))
        upper = int(min(255, 1.33 * v))
        edges = cv2.Canny(gray, lower, upper)
        edge_density = float((edges > 0).sum()) / (gray.shape[0] * gray.shape[1])

        ph, pw = 64, 64
        H, W = gray.shape
        stds = []
        for y in range(0, H, ph):
            for x in range(0, W, pw):
                patch = gray[y:y+ph, x:x+pw]
                if patch.size == 0:
                    continue
                stds.append(float(patch.std()))
        patch_std_mean = float(np.mean(stds)) if len(stds) else 0.0

        return {"lap_var": lap_var, "edge_density": edge_density, "patch_std_mean": patch_std_mean}
    except Exception:
        return None

LAP_VAR_TH = 200.0
EDGE_DENSITY_TH = 0.02
PATCH_STD_TH = 8.0

def _is_close_up_local(metrics: dict):
    if not metrics:
        return False
    count = 0
    if metrics.get("lap_var", 0.0) >= LAP_VAR_TH: count += 1
    if metrics.get("edge_density", 0.0) >= EDGE_DENSITY_TH: count += 1
    if metrics.get("patch_std_mean", 0.0) >= PATCH_STD_TH: count += 1
    return count >= 2

def _reason_mentions_person_like(text: str):
    if not text:
        return False
    low = text.lower()
    keywords = ["person", "people", "mannequin", "mannequins", "human", "body", "face", "faces", "hand", "hands", "wearing", "worn"]
    return any(k in low for k in keywords)

def _contains_face_bytes(image_bytes: bytes):
    if cv2 is None:
        return False
    try:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return False
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        faces = cascade.detectMultiScale(img, scaleFactor=1.1, minNeighbors=4, minSize=(20,20))
        return len(faces) > 0
    except Exception:
        return False

@router.post("/validate-image")
async def validate_image(image: UploadFile = File(...)):
    t0 = time.time()
    try:
        raw = await image.read()
        t1 = time.time()

        img_hash = _sha256(raw)

        cached = _cache_get(img_hash)
        if cached:
            print(f"[validate-image] cache-hit verdict={cached} total={(time.time()-t0)*1000:.0f}ms")
            return JSONResponse(content={"valid": cached["verdict"] == "valid", "reason": cached.get("reason",""), "meta": cached.get("meta", {})})

        local_metrics_raw = _texture_metrics_from_bytes(raw) if cv2 is not None else None
        if local_metrics_raw is not None:
            if local_metrics_raw.get("lap_var", 0.0) < 20:
                reason = "blurry image (very low laplacian variance)"
                _cache_set(img_hash, {"verdict":"invalid", "reason":reason, "meta":{"metrics":local_metrics_raw}})
                return JSONResponse(content={"valid": False, "reason": reason, "meta":{"metrics": local_metrics_raw}})

        small_jpeg = await asyncio.to_thread(_resize_to_jpeg, raw)
        t2 = time.time()

        b64 = _to_b64(small_jpeg)
        try:
            response_text = await asyncio.wait_for(_gemini_check_base64(b64), timeout=GEMINI_TIMEOUT_SEC)
        except asyncio.TimeoutError:
            print(f"[validate-image] timeout total={(time.time()-t0)*1000:.0f}ms")
            return JSONResponse(status_code=504, content={"valid": False, "reason": "Validation timed out"})

        t3 = time.time()
        response_text = (response_text or "").strip()
        parsed = None
        reason = ""
        verdict = "invalid"
        model_meta = {"raw": response_text}

        try:
            candidate_json = _extract_json_object_from_text(response_text)
            if candidate_json:
                parsed = json.loads(candidate_json)
            else:
                parsed = None
        except Exception:
            parsed = None

        texture_visible_flag = None
        model_texture_conf = None
        pattern_full_motif = None

        if parsed and isinstance(parsed, dict):
            mv = parsed.get("verdict", "").lower()
            reason = parsed.get("reason", "") or ""
            texture_visible_flag = parsed.get("texture_visible", None)
            pattern_full_motif = parsed.get("pattern_full_motif", None)
            try:
                model_texture_conf = float(parsed.get("texture_confidence")) if parsed.get("texture_confidence") is not None else None
            except Exception:
                model_texture_conf = None
            model_meta.update({"parsed_model": parsed, "texture_visible": texture_visible_flag, "texture_confidence": model_texture_conf, "pattern_full_motif": pattern_full_motif})
            if mv in ("valid", "valid."):
                verdict = "valid"
            else:
                verdict = "invalid"
        else:
            low = response_text.lower()
            model_meta.update({"parse_error": True})
            if "valid" in low and "invalid" not in low:
                verdict = "valid"
                reason = response_text
            elif "invalid" in low:
                verdict = "invalid"
                reason = response_text
            else:
                verdict = "invalid"
                reason = "uncertain: unparseable response from model"
            model_meta["heuristic_reason"] = reason

        local_metrics = _texture_metrics_from_bytes(small_jpeg) if cv2 is not None else None
        if local_metrics:
            model_meta["metrics"] = local_metrics

        lower_reason = (reason or "").lower()
        model_indicated_not_closeup = any(kw in lower_reason for kw in ["not a close-up", "not close-up", "shows entire pattern", "entire pattern", "scene with multiple", "contains a scene"])

        mentions_person = _reason_mentions_person_like(reason)
        face_found = _contains_face_bytes(small_jpeg) if cv2 is not None else False

        if verdict == "invalid":
            if (texture_visible_flag is True or (model_texture_conf is not None and model_texture_conf >= 0.6)):
                if not mentions_person and not face_found:
                    prev_reason = reason
                    verdict = "valid"
                    reason = f"accepted by model texture_conf={model_texture_conf} texture_visible={texture_visible_flag} (prev_reason='{prev_reason}')"
                    model_meta["override"] = {"by_texture_conf": True, "model_texture_conf": model_texture_conf, "mentions_person": mentions_person, "face_found": face_found}

            elif model_indicated_not_closeup:
                local_ok = _is_close_up_local(local_metrics) if local_metrics else False
                if local_ok and not mentions_person and not face_found:
                    prev_reason = reason
                    verdict = "valid"
                    reason = f"overrode model due to strong local texture heuristics (prev_reason='{prev_reason}')"
                    model_meta["override"] = {"by_local_metrics": True, "metrics": local_metrics}

        out_meta = model_meta.copy()
        _cache_set(img_hash, {"verdict": verdict, "reason": reason, "meta": out_meta})

        print(f"[validate-image] read={(t1-t0)*1000:.0f}ms resize={(t2-t1)*1000:.0f}ms gemini={(t3-t2)*1000:.0f}ms total={(t3-t0)*1000:.0f}ms verdict={verdict} meta_metrics={out_meta.get('metrics', {})}")

        return JSONResponse(content={"valid": verdict == "valid", "reason": reason, "meta": out_meta})

    except Exception as e:
        print("Validation error:", e)
        return JSONResponse(status_code=500, content={"valid": False, "error": str(e)})
