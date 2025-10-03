# tools/mcpserver.py
from typing import Optional, Literal, Dict, Any, List
from mcp.server.fastmcp import FastMCP
import importlib
import traceback
from PIL import Image
from tools.media_tools import redirect_to_media_analysis as _media_tool
from tools.search_tool import search_tool as _search_tool
from services.threaded import analyse_all_variations
from utils.cache import get_response

from urllib.parse import urlparse
from pathlib import Path
from constants import IMAGE_DIR

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

def _resolve_image_path_from_url(image_url: Optional[str]) -> Optional[str]:
    if not image_url:
        return None
    try:
        parsed = urlparse(image_url)
        filename = Path(parsed.path).name
        img_path = IMAGE_DIR / filename
        if img_path.exists():
            return str(img_path)
        return None
    except Exception:
        return None


@mcp.tool()
def redirect_to_analysis(
    image_url: Optional[str] = None,
    mode: Literal["short", "long"] = "short",
) -> Dict[str, Any]:
    print("🔍 MCP redirect_to_analysis called")
    print("  image_url =", image_url, "mode =", mode)

    params = {"image_url": image_url, "mode": mode}

    try:
        if not image_url:
            return {"action": {"type": "redirect_to_analysis", "params": params}, "bot_messages": ["No image url"]}

        # Instead of fetching via HTTP, resolve local file path
        parsed = urlparse(image_url)
        filename = Path(parsed.path).name  # e.g. "86d2d7d928e849d5bb5bcbe0f076276d.jfif"
        img_path = IMAGE_DIR / filename

        if not img_path.exists():
            return {"action": {"type": "redirect_to_analysis", "params": params}, "bot_messages": ["Image not found on server"]}

        img = Image.open(img_path)
        print("  Opened image format =", img.format, "size =", img.size)

        # Call analyzer
        raw = analyse_all_variations(img, mode)
        print("  analyse_all_variations returned:", raw)

        cache_key = raw.get("cache_key")
        first = raw.get("first")

        if not first:
            return {"action": {"type": "redirect_to_analysis", "params": params}, "bot_messages": ["No response from analyzer"]}

        response_text = first.get("response")

        return {
            "action": {"type": "redirect_to_analysis", "params": {**params, "cache_key": cache_key}},
            "bot_messages": ["Here is the first result:", response_text],
            "analysis_responses": [{"id": first["id"], "text": response_text}],
        }

    except Exception as e:
        print("💥 Exception in redirect_to_analysis:", e)
        print(traceback.format_exc())
        return {"action": {"type": "redirect_to_analysis", "params": params}, "bot_messages": [f"Error: {e}"]}

SERVED_RESPONSES = {}
@mcp.tool()
def regenerate(
    cache_key: Optional[str] = None,
    image_url: Optional[str] = None,
    mode: Literal["short", "long"] = "short",
    fresh: bool = False,
    **kwargs
) -> Dict[str, Any]:
    print("🔄 MCP regenerate called (IMPROVED)")
    print("  cache_key =", cache_key, "image_url =", image_url, "mode =", mode, "fresh =", fresh)

    if not cache_key:
        return {
            "error": "no_cache_key",
            "message": "Regenerate requires a cache_key"
        }

    served = SERVED_RESPONSES.get(cache_key, [])

    # ✅ Look for next unserved response
    for i in range(2, 7):
        if i in served:
            continue

        resp = get_response(cache_key, i)
        if resp is None:
            return {
                "error": "pending",
                "message": f"No cached response ready yet for index={i}"
            }

        # ✅ Mark as served
        served.append(i)
        SERVED_RESPONSES[cache_key] = served

        # ✅ Normalize shape
        if isinstance(resp, dict):
            text = resp.get("response") or resp.get("text") or resp.get("message") or str(resp)
            rid = str(resp.get("id", i))
        else:
            text, rid = str(resp), str(i)

        return {
            "response": {
                "id": rid,
                "response": text,
            },
            "selected_index": i
        }

    # ✅ If all are served
    return {
        "error": "exhausted",
        "message": "All cached alternatives have been shown. Upload the image to analyze again."
    }

@mcp.tool()
def redirect_to_media_analysis(
    image_url: Optional[str] = None,
    audio_url: Optional[str] = None,
    filename: Optional[str] = None,
) -> Dict[str, Any]:
    try:
        if image_url and not audio_url:
            return redirect_to_analysis(image_url=image_url, mode="short")

        if image_url and audio_url:
            return _media_tool(image_url=image_url, audio_url=audio_url, filename=filename)

        return {
            "action": {"type": "redirect_to_media_analysis", "params": {"image_url": image_url, "audio_url": audio_url}},
            "bot_messages": ["❌ No image_url provided."],
        }

    except Exception as e:
        return {
            "action": {"type": "redirect_to_media_analysis", "params": {"image_url": image_url, "audio_url": audio_url}},
            "bot_messages": [f"💥 Error in redirect_to_media_analysis: {e}", traceback.format_exc()],
        }


@mcp.tool()
def search(**kwargs) -> Dict[str, Any]:
    print("🔍 MCP search called")

    # Allow passing image_url from router → resolve to local image_path for search_tool
    image_url = kwargs.pop("image_url", None)
    image_path = kwargs.get("image_path")
    image_b64 = kwargs.get("image_b64")
    image_bytes = kwargs.get("image_bytes")

    if image_url and not (image_path or image_b64 or image_bytes):
        resolved = _resolve_image_path_from_url(image_url)
        if resolved:
            kwargs["image_path"] = resolved
        else:
            return {"error": f"Image not found on server for URL: {image_url}"}

    return _search_tool(**kwargs)


@mcp.tool()
def search_base64(**kwargs) -> Dict[str, Any]:
    print("🔍 MCP search_base64 called")
    return _search_tool(**kwargs)


def sse_app():
    return mcp.sse_app()
