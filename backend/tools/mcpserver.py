# tools/mcpserver.py
from typing import Optional, Literal, Dict, Any, List
from mcp.server.fastmcp import FastMCP
import importlib
import traceback
import requests
from io import BytesIO
from PIL import Image

from services.threaded import analyse_all_variations
from utils.cache import get_response

mcp = FastMCP("fabric-tools")

_ANALYZE_CANDIDATES = [
    ("tools.analyze", "analyze"),
    ("tools.analyze", "analyze_image"),
    ("tools.analysis", "analyze"),
    ("tools.analysis_service", "analyze_image"),
    ("tools.analyser", "analyze_image"),
    ("tools.analyse", "analyze_image"),
    ("tools.api.analyze", "analyze"),
    ("tools.tools", "analyze_image"),
]

_REGENERATE_CANDIDATES = [
    ("tools.regenerate", "regenerate"),
    ("tools.regenerate", "regenerate_responses"),
    ("tools.analysis", "regenerate"),
    ("tools.analyze", "regenerate"),
    ("tools.analysis_service", "regenerate"),
]


def _safe_find(fn_candidates):
    for mod_name, fn_name in fn_candidates:
        try:
            mod = importlib.import_module(mod_name)
            fn = getattr(mod, fn_name, None)
            if callable(fn):
                return fn
        except Exception:
            continue
    return None


_analyze_fn = _safe_find(_ANALYZE_CANDIDATES)
_regenerate_fn = _safe_find(_REGENERATE_CANDIDATES)


def _normalize_responses(raw) -> List[Dict[str, str]]:
    if raw is None:
        return []
    if isinstance(raw, dict):
        for k in ("responses", "results", "data", "analysis_responses"):
            v = raw.get(k)
            if isinstance(v, list):
                raw = v
                break
        else:
            if "text" in raw or "message" in raw:
                return [{"id": raw.get("id", "r0"), "text": raw.get("text") or raw.get("message") or str(raw)}]
            return []
    if isinstance(raw, list):
        out = []
        for i, item in enumerate(raw):
            if isinstance(item, str):
                out.append({"id": f"r{i}", "text": item})
            elif isinstance(item, dict):
                rid = item.get("id") or item.get("response_id") or item.get("rid") or f"r{i}"
                text = item.get("text") or item.get("content") or item.get("message") or str(item)
                out.append({"id": rid, "text": text})
            else:
                out.append({"id": f"r{i}", "text": str(item)})
        return out
    return [{"id": "r0", "text": str(raw)}]


def _rotate_next(responses: List[Dict[str, str]], used_ids: List[str]) -> Optional[Dict[str, str]]:
    for r in responses:
        if r["id"] not in (used_ids or []):
            return r
    return None


def _extract_cache_key(raw) -> Optional[str]:
    """
    If the analyze tool returns a dict with cache_key, pull it out.
    """
    if not raw:
        return None
    if isinstance(raw, dict):
        return raw.get("cache_key")
    return None


@mcp.tool()
def redirect_to_analysis(
    image_url: Optional[str] = None,
    mode: Literal["short", "long"] = "short",
) -> Dict[str, Any]:
    print("🔍 MCP redirect_to_analysis called")
    print("  image_url =", image_url, "mode =", mode)

    params = {"image_url": image_url, "mode": mode}
    bot_messages = ["Debugging redirect_to_analysis..."]

    try:
        if not image_url:
            print("❌ No image_url provided")
            return {"action": {"type": "redirect_to_analysis", "params": params}, "bot_messages": ["No image url"]}

        # Download image
        r = requests.get(image_url, timeout=20)
        print("  HTTP GET status =", r.status_code, "bytes =", len(r.content))
        r.raise_for_status()

        # Open with PIL
        from PIL import Image
        from io import BytesIO
        img = Image.open(BytesIO(r.content))
        print("  Opened image format =", img.format, "size =", img.size)

        # Call analyzer
        raw = analyse_all_variations(img, mode)
        print("  analyse_all_variations returned:", raw)

        cache_key = raw.get("cache_key")
        first = raw.get("first")
        print("  cache_key =", cache_key, "first =", first)

        if not first:
            print("❌ No first response received")
            return {"action": {"type": "redirect_to_analysis", "params": params}, "bot_messages": ["No response from analyzer"]}

        response_text = first.get("response")
        print("✅ First response:", response_text[:100] if response_text else None)

        return {
            "action": {"type": "redirect_to_analysis", "params": {**params, "cache_key": cache_key}},
            "bot_messages": ["Here is the first result:", response_text, "Do you prefer this response? (Yes / No)"],
            "analysis_responses": [{"id": first["id"], "text": response_text}],
        }

    except Exception as e:
        import traceback
        print("💥 Exception in redirect_to_analysis:", e)
        print(traceback.format_exc())
        return {"action": {"type": "redirect_to_analysis", "params": params}, "bot_messages": [f"Error: {e}"]}



@mcp.tool()
def regenerate(
    cache_key: Optional[str] = None,
    index: Optional[int] = None,
    used_ids: Optional[List[str]] = None,
    image_url: Optional[str] = None,
    mode: Literal["short", "long"] = "short",
    fresh: bool = False,
) -> Dict[str, Any]:
    """
    Regenerate using either cache (preferred) or fallback analyze tool.
    """
    # First try cache_key path
    if cache_key:
        if index is not None:
            resp = get_response(cache_key, index)
            if resp is not None:
                return {"response": resp, "selected_index": index}
            else:
                return {"error": "pending", "message": f"No cached response yet for key={cache_key}, index={index}"}

        # try to find next unused
        for i in range(1, 7):
            if used_ids and any(str(u) == str(i) for u in used_ids):
                continue
            resp = get_response(cache_key, i)
            if resp is not None:
                return {"response": resp, "selected_index": i}
        return {"error": "exhausted", "message": "No cached alternatives ready; call with fresh=true to generate new set."}

    # fallback to any available regenerate tool
    if _regenerate_fn:
        try:
            try:
                out = _regenerate_fn(image_url=image_url, used_ids=used_ids, mode=mode, fresh=fresh)
            except TypeError:
                try:
                    out = _regenerate_fn(image_url, used_ids or [], mode, fresh)
                except Exception:
                    out = _regenerate_fn(image_url=image_url, used_ids=used_ids, mode=mode)
            if isinstance(out, dict):
                if "response" in out or "responses" in out:
                    return out
                norm = _normalize_responses(out.get("responses") if isinstance(out, dict) else out)
                if norm:
                    return {"responses": norm, "selected_index": 0}
            elif isinstance(out, list):
                return {"responses": _normalize_responses(out), "selected_index": 0}
            return {"error": "regenerate tool returned unexpected shape"}
        except Exception as e:
            return {"error": f"regenerate tool call failed: {str(e)}"}

    if not _analyze_fn:
        return {"error": "no regenerate or analyze tool available"}

    try:
        if fresh:
            try:
                raw = _analyze_fn(image_url=image_url, mode=mode)
            except TypeError:
                raw = _analyze_fn(image_url, mode)
            responses = _normalize_responses(raw)
            if responses:
                return {"responses": responses, "selected_index": 0}
            return {"error": "analyze returned no responses on fresh regenerate"}

        try:
            raw = _analyze_fn(image_url=image_url, mode=mode)
        except TypeError:
            raw = _analyze_fn(image_url, mode)
        responses = _normalize_responses(raw)
        next_r = _rotate_next(responses, used_ids or [])
        if next_r:
            idx = next((i for i, r in enumerate(responses) if r["id"] == next_r["id"]), 0)
            return {"response": next_r, "selected_index": idx}
        return {"error": "exhausted", "message": "All cached alternatives exhausted; call with fresh=true to generate a new set."}
    except Exception as e:
        return {"error": f"regenerate fallback failed: {str(e)}", "trace": traceback.format_exc()}


def sse_app():
    return mcp.sse_app()
