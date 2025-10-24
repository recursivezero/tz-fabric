# tools/mcpserver.py
from typing import Optional, Literal, Dict, Any, List
from mcp.server.fastmcp import FastMCP
import importlib
import traceback
from PIL import Image
from tools.media_tools import redirect_to_media_analysis as media_tool
from tools.search_tool import search_tool as _search_tool
from services.threaded import analyse_all_variations
from utils.cache import get_response

from urllib.parse import urlparse
from pathlib import Path
from constants import IMAGE_DIR

mcp = FastMCP("fabric-tools")

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
    image_path: Optional[str] = None,                 
    mode: Literal["short", "long"] = "short",
) -> Dict[str, Any]:
    print("🔍 MCP redirect_to_analysis called", {"image_url": image_url, "image_path": image_path, "mode": mode})

    path = None
    if image_path:
        p = Path(image_path)
        if not p.exists():
            return {"ok": False, "error": {"code": "image_missing", "message": f"image_path not found: {image_path}"}}
        path = str(p)
    else:
        path = _resolve_image_path_from_url(image_url)
        if not path:
            return {"ok": False, "error": {"code": "image_not_found", "message": "Image not found on server."}}

    try:
        img = Image.open(path)
        raw = analyse_all_variations(img, mode)
        cache_key = raw.get("cache_key")
        first = raw.get("first")
        if not first:
            return {"ok": False, "error": {"code": "no_result", "message": "Analyzer returned no response"}}

        txt = first.get("response", "")
        return {
            "ok": True,
            "action": {"type": "redirect_to_analysis", "params": {"cache_key": cache_key, "mode": mode}},
            "bot_messages": ["Here is the first result:", txt],
            "analysis_responses": [{"id": first.get("id", "1"), "text": txt}],
            "_via": "mcp.analysis",
        }
    except Exception as e:
        import traceback
        return {"ok": False, "error": {"code": "analysis_error", "message": str(e)}, "trace": traceback.format_exc()}
    
SERVED_RESPONSES = {}
SERVED_RESPONSES = {}

@mcp.tool()
def regenerate(
    cache_key: Optional[str] = None,
    image_url: Optional[str] = None,
    mode: Literal["short", "long"] = "short",
) -> Dict[str, Any]:

    print("🔄 MCP regenerate called")
    print("  cache_key =", cache_key, "image_url =", image_url, "mode =", mode)

    if not cache_key:
        return {
            "ok": False,
            "display_text": "Missing cache_key for regeneration.",
            "error": {"code": "no_cache_key"},
            "_via": "mcp.regenerate"
        }

    served = SERVED_RESPONSES.get(cache_key, [])

    # cycle 2–6
    for i in range(2, 7):
        if i in served:
            continue

        resp = get_response(cache_key, i)
        if resp is None:
            return {
                "ok": False,
                "display_text": "⏳ Still generating more variations… try again in a moment.",
                "error": {"code": "pending"},
                "_via": "mcp.regenerate"
            }

        served.append(i)
        SERVED_RESPONSES[cache_key] = served

        if isinstance(resp, dict):
            txt = resp.get("response") or resp.get("text") or resp.get("message") or str(resp)
            rid = str(resp.get("id", i))
        else:
            txt, rid = str(resp), str(i)

        return {
            "ok": True,
            "display_text": txt,
            "analysis_responses": [{"id": rid, "text": txt}],
            "selected_index": i,
            "_via": "mcp.regenerate"
        }

    # all served
    return {
        "ok": False,
        "display_text": "All cached alternatives shown. Upload again for new analysis.",
        "error": {"code": "exhausted"},
        "_via": "mcp.regenerate"
    }

@mcp.tool()
def redirect_to_media_analysis(
    image_path: Optional[str] = None,
    audio_path: Optional[str] = None,
    filename: Optional[str] = None,
    image_url: Optional[str] = None,
    audio_url: Optional[str] = None,
) -> Dict[str, Any]:
    print("🧭 MCP redirect_to_media_analysis called:", {
        "image_path": image_path, "audio_path": audio_path,
        "image_url": image_url, "audio_url": audio_url, "filename": filename
    })
    try:
        out = media_tool(
            image_path=image_path,
            audio_path=audio_path,
            filename=filename,
            image_url=image_url,
            audio_url=audio_url,
        )
        if not isinstance(out, dict):
            return {"ok": False, "error": {"code": "bad_output", "message": "media_tool returned non-dict"}}
        out.setdefault("ok", True)
        out["_via"] = "mcp.media"
        return out
    except Exception as e:
        import traceback
        return {"ok": False, "error": {"code": "media_tool_error", "message": str(e)}, "trace": traceback.format_exc()}
    except Exception as e:
        return {
            "action": {"type": "redirect_to_media_analysis", "params": {"image_url": image_url, "audio_url": audio_url}},
            "bot_messages": [f"💥 Error in redirect_to_media_analysis: {e}", traceback.format_exc()],
        }

@mcp.tool()
def search(
    *,
    image_url: Optional[str] = None,
    image_path: Optional[str] = None,
    image_b64: Optional[str] = None,
    k: int = 5,
    order: Literal["recent", "score"] = "recent",
    debug_ts: bool = False,
    min_sim: float = 0.5,
    require_audio: bool = False,  
) -> Dict[str, Any]:
    print("🔍 MCP search called")

    try:
        resolved_path = image_path
        if image_url and not (image_path or image_b64):
            resolved = _resolve_image_path_from_url(image_url)
            if not resolved:
                return {
                    "ok": False,
                    "error": {"code": "not_found", "message": f"Image not found on server for URL: {image_url}"},
                    "hint": "Ensure you used the upload endpoint and the filename matches files in IMAGE_DIR.",
                    "_via": "mcp.search",
                }
            resolved_path = resolved

        if not (resolved_path or image_b64):
            return {
                "ok": False,
                "error": {"code": "no_image", "message": "Provide image_url (resolvable), image_path, or image_b64."},
                "hint": "If you only have a local file in the browser, upload it first to get an image_url.",
                "_via": "mcp.search",
            }

        out = _search_tool(
            image_b64=image_b64,
            image_path=resolved_path,
            k=int(k),
            order=order,
            debug_ts=bool(debug_ts),
            min_sim=float(min_sim),
            require_audio=bool(require_audio),
        )

        if not isinstance(out, dict):
            return {
                "ok": False,
                "error": {"code": "bad_tool_output", "message": "search_tool returned a non-dict result"},
                "_via": "mcp.search",
            }

        out.setdefault("count", len(out.get("results", []) if isinstance(out.get("results"), list) else []))
        out["ok"] = True
        out["_via"] = "mcp.search"
        return out

    except Exception as e:
        import traceback
        return {
            "ok": False,
            "error": {"code": "search_failed", "message": str(e)},
            "trace": traceback.format_exc(),
            "_via": "mcp.search",
        }

@mcp.tool()
def search_base64(
    *,
    image_b64: str,
    k: int = 5,
    order: Literal["recent", "score"] = "recent",
    debug_ts: bool = False,
    min_sim: float = 0.5,
    require_audio: bool = False,
) -> Dict[str, Any]:
    print("🔍 MCP search_base64 called")
    try:
        out = _search_tool(
            image_b64=image_b64,
            image_path=None,
            k=int(k),
            order=order,
            debug_ts=bool(debug_ts),
            min_sim=float(min_sim),
            require_audio=bool(require_audio),
        )
        if not isinstance(out, dict):
            return {
                "ok": False,
                "error": {"code": "bad_tool_output", "message": "search_tool returned a non-dict result"},
                "_via": "mcp.search_base64",
            }
        out.setdefault("count", len(out.get("results", []) if isinstance(out.get("results"), list) else []))
        results = out.get("results", [])

        analysis_responses = []
        for idx, item in enumerate(results):
            meta = item.get("metadata", {})
            img = meta.get("imageUrl")
            aud = meta.get("audioUrl")
            score = item.get("score", 0)
            text = f"Match {idx+1}: score={score:.2f}"
            if img:
                text += f"\nImage: {img}"
            if aud:
                text += f"\nAudio: {aud}"
            analysis_responses.append({"id": str(idx+1), "text": text})

        return {
            "ok": True,
            "display_text": f"Found {len(analysis_responses)} similar match(es).",
            "analysis_responses": analysis_responses,
            "results": results,      
            "_via": "mcp.search",
        }

    except Exception as e:
        import traceback
        return {
            "ok": False,
            "error": {"code": "search_failed", "message": str(e)},
            "trace": traceback.format_exc(),
            "_via": "mcp.search_base64",
        }

def sse_app():
    print("✅ Connecting MCP Server")
    return mcp.sse_app()
