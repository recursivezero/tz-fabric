# agent/graph.py
from typing import Optional, Literal, Dict, Any
import re, json, traceback

from langchain_core.runnables import RunnableLambda
from langchain_groq import ChatGroq

from core.config import settings
from tools import mcpserver as mcp

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
        return mcp.redirect_to_analysis(
            image_url=params.get("image_url"),
            mode=params.get("mode", "short"),
        )
    except Exception as e:
        return {
            "action": {"type": "redirect_to_analysis", "params": params},
            "bot_messages": [f"Error: {e}", traceback.format_exc()],
        }

def call_regenerate(params: Dict[str, Any]) -> Dict[str, Any]:
    
    try:
        cache_key = params.get("cache_key")
        index = params.get("index")
        image_url = params.get("image_url")
        mode = params.get("mode", "short")

        # normalize used_ids (UI may send strings)
        used_ids = _normalize_used_ids(params.get("used_ids"))

        # policy: allow fresh if exhausted unless explicitly disabled
        fresh_if_exhausted = params.get("fresh_if_exhausted", True)

        # 1) cached path (token-safe; no new generation)
        out = mcp.regenerate(
            cache_key=cache_key,
            index=index,
            used_ids=used_ids,
            image_url=image_url,
            mode=mode,
            fresh=False,
        )

        if isinstance(out, dict) and out.get("error") == "exhausted" and fresh_if_exhausted:
            out = mcp.regenerate(
                cache_key=cache_key,
                index=None,            
                used_ids=None,        
                image_url=image_url,  
                mode=mode,
                fresh=True,
            )

        return out

    except Exception as e:
        return {
            "type": "regenerate",
            "params": params,
            "bot_messages": [f"Error: {e}", traceback.format_exc()],
        }

def call_redirect_to_media_analysis(params: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return mcp.redirect_to_media_analysis(
            image_url=params.get("image_url"),
            audio_url=params.get("audio_url"),
            filename=params.get("filename"),
        )
    except Exception as e:
        return {
            "action": {"type": "redirect_to_media_analysis", "params": params},
            "bot_messages": [f"Error: {e}", traceback.format_exc()],
        }

def call_search(params: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return mcp.search(**params)
    except Exception as e:
        return {"type": "search", "params": params, "bot_messages": [f"Error: {e}", traceback.format_exc()]}

# ---- tool dispatch map (unchanged keys so router_fn stays as-is)
_TOOL_DISPATCH = {
    "redirect_to_analysis": call_redirect_to_analysis,
    "regenerate": call_regenerate,
    "redirect_to_media_analysis": call_redirect_to_media_analysis,
    "search": call_search,
}

IMAGE_URL_RE = re.compile(r"https?://\S+\.(?:jpg|jpeg|png|jfif|webp|gif|bmp|tiff)", re.I)
AUDIO_URL_RE = re.compile(r"https?://\S+\.(?:mp3|wav|m4a|ogg|flac)", re.I)

def router_fn(user_text: str) -> Dict[str, Any]:
    if not user_text:
        return {"tool": "agent", "params": {"text": ""}}

    t_raw = user_text.strip()
    t = t_raw.lower()

    img_match = IMAGE_URL_RE.search(t_raw)
    aud_match = AUDIO_URL_RE.search(t_raw)

    # Rule 1: image + audio → media analysis
    if img_match and aud_match:
        return {
            "tool": "redirect_to_media_analysis",
            "params": {"image_url": img_match.group(0), "audio_url": aud_match.group(0)},
        }

    if img_match:
        mode = "long" if re.search(r"\b(long|detailed|full|deep|comprehensive|in-depth)\b", t, re.I) else "short"
        return {"tool": "redirect_to_analysis", "params": {"image_url": img_match.group(0), "mode": mode}}

    if re.search(r"\b(regen|regenerate|regeneration|variant|alternative|another|next alternative|more variants)\b", t, re.I):
  
        m_cache = re.search(r"cache[_\- ]?key[:= ]?([A-Za-z0-9_\-]+)", t_raw)
        m_index = re.search(r"\bindex[:= ]?(\d+)\b", t_raw)
        params: Dict[str, Any] = {}
        if m_cache:
            params["cache_key"] = m_cache.group(1)
        if m_index:
            try:
                params["index"] = int(m_index.group(1))
            except Exception:
                pass
        params["user_text"] = user_text
        return {"tool": "regenerate", "params": params}

    if re.search(r"\b(search|find|show previous|history|past results|examples|similar|lookup)\b", t, re.I):
        return {"tool": "search", "params": {"q": user_text}}

    return {"tool": "agent", "params": {"text": user_text}}

def llm_router(user_text: str, confidence_threshold: float = 0.6) -> Optional[Dict[str, Any]]:
    
    prompt = (
        "You are a router. Decide which single tool to call for the following user text.\n"
        "Tools: redirect_to_analysis, redirect_to_media_analysis, regenerate, search, none.\n"
        "Return ONLY JSON: {\"tool\":\"<tool_name>\", \"confidence\":0.0-1.0, \"params\":{...}}\n\n"
        f"User text:\n'''{user_text}'''\n"
        "If none is appropriate, return tool 'none' with confidence 0.0."
    )
    try:
        resp = llm.chat([
            {"role": "system", "content": "You are a router model."},
            {"role": "user", "content": prompt},
        ])
        raw = resp.get("content") if isinstance(resp, dict) else str(resp)
        parsed = None
        try:
            parsed = json.loads(raw)
        except Exception:
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            if m:
                try:
                    parsed = json.loads(m.group(0))
                except Exception:
                    parsed = None
        if not parsed or not isinstance(parsed, dict):
            return None
        tool = parsed.get("tool")
        conf = float(parsed.get("confidence", 0.0))
        params = parsed.get("params", {}) or {}
        if tool == "none" or conf < confidence_threshold:
            return None
        return {"tool": tool, "params": params, "confidence": conf}
    except Exception:
        return None

SYSTEM_PROMPT = (
    "You are a Fabric Assistant.\n"
    "- Answer questions about fabrics, textiles, and how to use this app.\n"
    "- If unrelated to fabrics or this app, politely refuse.\n"
    "- Never invent tool names. Only reply conversationally here.\n"
)

def agent_fallback(params: Dict[str, Any]) -> str:
    
    user_text = params.get("text", "")
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_text},
    ]
    try:
        resp = llm.invoke(messages)
        if hasattr(resp, "content"):
            return resp.content
        if isinstance(resp, dict) and resp.get("content"):
            return resp.get("content")
        return str(resp)
    except Exception as e:
        return f"Error calling LLM: {e}"

def _agent_graph_callable(user_text: str) -> Any:
    try:
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

        # fallback: conversational agent
        return agent_fallback({"text": user_text})

    except Exception as e:
        return {"error": f"agent_graph_error: {e}", "trace": traceback.format_exc()}

agent_graph = RunnableLambda(_agent_graph_callable)

__all__ = [
    "agent_graph",
    "llm",
    "SYSTEM_PROMPT",
]
