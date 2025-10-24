from typing import Optional, Literal, Dict, Any, List, Union
import re, json, traceback

from langchain_core.runnables import RunnableLambda
from langchain_groq import ChatGroq

from core.config import settings
from tools.mcp_client import invoke_tool_sync

llm = ChatGroq(
    api_key=settings.GROQ_API_KEY,
    model=settings.GROQ_MODEL,
    temperature=0,
)


def _normalize_used_ids(uids) -> list[int]:
    """Accept ['1','2','r3', 4] and normalize to [1,2,3,4]."""
    if not uids:
        return []
    out = []
    for u in uids:
        s = str(u)
        m = re.search(r"\d+", s)
        if not m:
            continue
        out.append(int(m.group(0)))
    return out


def call_redirect_to_analysis(params: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return invoke_tool_sync("redirect_to_analysis", params)
    except Exception as e:
        return {
            "action": {"type": "redirect_to_analysis", "params": params},
            "bot_messages": [f"Error calling MCP tool redirect_to_analysis: {e}", traceback.format_exc()],
        }


def call_regenerate(params: Dict[str, Any]) -> Dict[str, Any]:
    try:
        if "used_ids" in params:
            params["used_ids"] = _normalize_used_ids(params["used_ids"])
        return invoke_tool_sync("regenerate", params)
    except Exception as e:
        return {
            "type": "regenerate",
            "params": params,
            "bot_messages": [f"Error calling MCP tool regenerate: {e}", traceback.format_exc()],
        }


def call_redirect_to_media_analysis(params: Dict[str, Any]):
    try:
        return invoke_tool_sync("redirect_to_media_analysis", params)
    except Exception as e:
        return {
            "action": {"type": "redirect_to_media_analysis", "params": params},
            "bot_messages": [f"Error calling MCP tool redirect_to_media_analysis: {e}", traceback.format_exc()],
        }


def call_search(params: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return invoke_tool_sync("search", params)
    except Exception as e:
        return {
            "type": "search",
            "params": params,
            "bot_messages": [f"Error calling MCP tool search: {e}", traceback.format_exc()],
        }


_TOOL_DISPATCH = {
    "redirect_to_analysis": call_redirect_to_analysis,
    "regenerate": call_regenerate,
    "redirect_to_media_analysis": call_redirect_to_media_analysis,
    "search": call_search,
}

IMAGE_URL_RE = re.compile(r"https?://\S+\.(?:jpg|jpeg|png|jfif|webp|gif|bmp|tiff)", re.I)
AUDIO_URL_RE = re.compile(r"https?://\S+\.(?:mp3|wav|m4a|ogg|flac)", re.I)

SEARCH_INTENT_RE = re.compile(
    r"\b(search|find|similar|lookup|match|reverse\s*image|examples|history|past\s*results|show\s*previous)\b",
    re.I,
)

ANALYZE_INTENT_RE = re.compile(r"\b(analy[sz]e|analysis|describe|inspect|classify|label|tag)\b", re.I)


def router_fn(user_text: str) -> Dict[str, Any]:
    if not user_text:
        return {"tool": "agent", "params": {"text": ""}}

    t_raw = user_text.strip()
    t = t_raw.lower()

    # Detect URLs
    img_url = IMAGE_URL_RE.search(t_raw)
    aud_url = AUDIO_URL_RE.search(t_raw)

    # Detect explicit server paths
    img_path = re.search(r"\bimage_path\s*=\s*(\S+)", t_raw)
    aud_path = re.search(r"\baudio_path\s*=\s*(\S+)", t_raw)

    # Optional filename
    m_fname = re.search(r"\bfilename\s*=\s*([^\s]+)", t_raw)
    fname = m_fname.group(1) if m_fname else None

    if re.search(r"\b(regen|regenerate|variant|alternative|another|next alternative|more variants)\b", t, re.I):
        params: Dict[str, Any] = {}
        m_cache = re.search(r"cache[_\- ]?key[:= ]?([A-Za-z0-9_\-]+)", t_raw)
        if m_cache:
            params["cache_key"] = m_cache.group(1)
        m_index = re.search(r"\bindex[:= ]?(\d+)\b", t_raw)
        if m_index:
            try:
                params["index"] = int(m_index.group(1))
            except Exception:
                pass
        m_img = re.search(r"\bimage_url\s*=\s*(https?://\S+)", t_raw)
        if m_img:
            params["image_url"] = m_img.group(1)
        m_mode = re.search(r"\bmode[:= ](short|long)\b", t, re.I)
        if m_mode:
            params["mode"] = m_mode.group(1).lower()
        if re.search(r"\bfresh\s*=\s*true\b", t, re.I):
            params["fresh"] = True
        params["user_text"] = user_text
        return {"tool": "regenerate", "params": params}

    has_img = bool(img_url or img_path)
    has_aud = bool(aud_url or aud_path)

    if has_img and has_aud:
        return {
            "tool": "redirect_to_media_analysis",
            "params": {
                "image_path": img_path.group(1) if img_path else None,
                "audio_path": aud_path.group(1) if aud_path else None,
                "image_url": img_url.group(0) if img_url else None,
                "audio_url": aud_url.group(0) if aud_url else None,
                "filename": fname,
            },
        }

    if has_img:
        if SEARCH_INTENT_RE.search(t):
            return {
                "tool": "search",
                "params": {
                    **({"image_path": img_path.group(1)} if img_path else {}),
                    **({"image_url": img_url.group(0)} if img_url else {}),
                    "k": 5,
                    "order": "recent",
                    "require_audio": False,
                    "min_sim": 0.5,
                },
            }

        mode = "long" if re.search(r"\b(long|detailed|full|deep|comprehensive|in-depth)\b", t, re.I) else "short"
        return {
            "tool": "redirect_to_analysis",
            "params": {
                **({"image_path": img_path.group(1)} if img_path else {}),
                **({"image_url": img_url.group(0)} if img_url else {}),
                "mode": mode,
            },
        }

    return {"tool": "agent", "params": {"text": user_text}}


SYSTEM_PROMPT = (
    "You are a Fabric Assistant.\n"
    "- Answer questions about fabrics, textiles, and how to use this app.\n"
    "- If unrelated to fabrics or this app, politely refuse.\n"
    "- Never invent tool names. Only reply conversationally here.\n"
)


def agent_fallback(params: Dict[str, Any]) -> str:
    user_text: str = params.get("text", "")
    history: List[Dict[str, str]] = params.get("history") or []
    # Keep only last ~6 turns to avoid long prompts
    clipped = history[-6:] if isinstance(history, list) else []
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in clipped:
        r = m.get("role")
        c = m.get("content")
        if r in ("user", "assistant", "system") and isinstance(c, str):
            messages.append({"role": r, "content": c})
    messages.append({"role": "user", "content": user_text})
    try:
        resp = llm.invoke(messages)
        if hasattr(resp, "content"):
            return resp.content
        if isinstance(resp, dict) and resp.get("content"):
            return resp.get("content")
        return str(resp)
    except Exception as e:
        return f"Error calling LLM: {e}"


def _agent_graph_callable(payload: Union[str, Dict[str, Any]]) -> Any:
    try:
        if isinstance(payload, str):
            user_text = payload
            history = None
        else:
            user_text = str(payload.get("text", "") or "")
            history = payload.get("history")

        decision = router_fn(user_text)

        tool = decision.get("tool")
        params = decision.get("params", {}) or {}

        if tool in _TOOL_DISPATCH:
            fn = _TOOL_DISPATCH[tool]
            try:
                out = fn(params or {})
                return out
            except Exception as e:
                return {"error": f"tool_call_failed: {e}", "trace": traceback.format_exc()}

        # fallback: conversational agent (with short history if provided)
        return agent_fallback({"text": user_text, "history": history or []})

    except Exception as e:
        return {"error": f"agent_graph_error: {e}", "trace": traceback.format_exc()}


agent_graph = RunnableLambda(_agent_graph_callable)

__all__ = [
    "agent_graph",
    "llm",
    "SYSTEM_PROMPT",
]
