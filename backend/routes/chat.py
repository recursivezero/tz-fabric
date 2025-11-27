# chat.py  (FULL replacement) — preserves existing features; stronger sanitizer + history cleaner
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Dict, Any
import re
import json
import logging
import difflib
import re as _re
import traceback

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])

# Attempt to import agent_graph; if import fails we still keep file valid
try:
    from agent.graph import agent_graph, SYSTEM_PROMPT
except Exception:
    agent_graph = None
    SYSTEM_PROMPT = (
        "You are a Fabric Assistant.\n"
        "- Answer questions about fabrics, textiles, and how to use this app.\n"
        "- If unrelated to fabrics or this app, politely refuse.\n"
        "- Never invent tool names. Only reply conversationally here.\n"
        "- IMPORTANT: Keep replies very short and concise (preferably 1–2 short sentences).\n"
    )
    logger.exception("Failed to import agent.graph at startup — agent_graph set to None. Ensure agent.graph is importable.")

Role = Literal["user", "assistant", "system"]


class Message(BaseModel):
    role: Role
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    messages: List[Message]


class Action(BaseModel):
    type: Literal["redirect_to_analysis", "redirect_to_media_analysis", "search"]
    params: Dict[str, Any]


class ChatResponse(BaseModel):
    reply: Message
    action: Optional[Action] = None
    bot_messages: Optional[List[str]] = None
    analysis_responses: Optional[List[Dict[str, Any]]] = None
    results: Optional[List[Dict[str, Any]]] = None
    ask_more: Optional[bool] = None
    ask_more_prompt: Optional[str] = None


ALLOWED_HINTS = [
    "fabric", "textile", "cloth", "garment", "apparel", "yarn", "fiber", "fibre", "cotton", "polyester",
    "silk", "wool", "linen", "denim", "viscose", "rayon", "nylon", "spandex", "elastane", "acrylic",
    "gsm", "weave", "warp", "weft", "fill", "knit", "woven", "nonwoven", "loom", "twill", "satin", "plain weave",
    "dye", "dyeing", "printing", "finishing", "bleach", "wash", "shrink", "shrinkage", "pilling", "drape",
    "handfeel", "tensile", "tear", "colorfastness", "martindale", "abrasion", "stretch", "recovery",
    "microfiber", "blend", "weft knit", "warp knit", "rib", "jersey", "interlock", "felting",
    "care", "wash care", "ironing", "detergent", "stain", "test", "testing",
    "analysis", "analyser", "analyzer", "upload", "image", "model", "tagging", "feature", "chatbot", "ui", "ux"
]

CHITCHAT_HINTS = [
    "hi", "hello", "hey", "good morning", "good evening",
    "how are you", "what can you do", "help", "thanks", "thank you"
]

REFUSAL_MESSAGE = "Sorry — I can only answer fabric/textile questions. Please try a fabric-related question."
CHITCHAT_RESPONSE = "Hi — I can help with fabric/textile questions or how to use this app. Ask about GSM, knit vs woven, or upload an image."


def _fuzzy_contains(text: str, hints: List[str], cutoff: float = 0.72) -> bool:
    if not text:
        return False
    t = text.lower()
    for h in hints:
        if h in t:
            return True
    tokens = re.findall(r"[a-zA-Z]+", t)
    if not tokens:
        tokens = [t]
    for tok in tokens:
        for h in hints:
            if " " in h:
                parts = h.split()
                for p in parts:
                    if p in tok:
                        return True
                    if difflib.SequenceMatcher(None, tok, p).ratio() >= cutoff:
                        return True
            else:
                if difflib.SequenceMatcher(None, tok, h).ratio() >= cutoff:
                    return True
    for h in hints:
        if difflib.SequenceMatcher(None, t, h).ratio() >= cutoff:
            return True
    return False


def _normalize_for_typos(text: str, hints: List[str], min_ratio: float = 0.80) -> str:
    if not text:
        return text
    single_words = set()
    for h in hints:
        for part in h.split():
            single_words.add(part.lower())
    single_words = sorted(single_words)
    tokens = re.findall(r"[a-zA-Z]+", text)
    if not tokens:
        return text
    normalized = text
    for tok in set(tokens):
        lower_tok = tok.lower()
        if lower_tok in single_words:
            continue
        matches = difflib.get_close_matches(lower_tok, single_words, n=1, cutoff=min_ratio)
        if matches:
            best = matches[0]
            normalized = re.sub(rf'\b{re.escape(tok)}\b', best, normalized, flags=re.IGNORECASE)
    return normalized


def classify_message(user_text: str) -> str:
    raw = (user_text or "").strip()
    if not raw:
        logger.debug("classify_message: empty input -> blocked")
        return "blocked"
    all_hints = ALLOWED_HINTS + CHITCHAT_HINTS
    try:
        normalized = _normalize_for_typos(raw, all_hints, min_ratio=0.80)
    except Exception:
        normalized = raw

    def _strip_detailed_wrappers_local(text: str) -> str:
        s = (text or "").strip()
        if not s:
            return s
        s = re.sub(r'(?i)^\s*(please\s+(provide|give|share)\s+(me\s+)?(a\s+)?|(please\s+)?)(detailed|long|full|comprehensive|in[-\s]?depth|extended|detailed answer|long answer|detailed reply|detailed response)\b[:\-\s]*', '', s).strip()
        s = re.sub(r'(?i)^\s*(detailed|long|full|in[-\s]?depth)\s*[:\-\s]+', '', s).strip()
        s = re.sub(r'(?i)\s*\(\s*(detailed|long|full|in[-\s]?depth)\s*\)\s*$', '', s).strip()
        s = re.sub(r'(?i)\s*[-–—]\s*(detailed|long|full|in[-\s]?depth)\s*$', '', s).strip()
        s = re.sub(r'(?i)\s*\b(detailed|long)\b\s*$', '', s).strip()
        return s or text

    try:
        cleaned = _strip_detailed_wrappers_local(normalized)
    except Exception:
        cleaned = normalized

    candidates = []
    if isinstance(cleaned, str) and cleaned.strip():
        candidates.append(cleaned.strip().lower())
    if isinstance(normalized, str) and normalized.strip() and normalized.strip().lower() not in candidates:
        candidates.append(normalized.strip().lower())
    if raw.strip().lower() not in candidates:
        candidates.append(raw.strip().lower())

    for cand in candidates:
        try:
            if _fuzzy_contains(cand, ALLOWED_HINTS, cutoff=0.72):
                logger.debug("classify_message: matched fabric candidate=%r", cand[:200])
                return "fabric"
        except Exception as e:
            logger.exception("classify_message: _fuzzy_contains error on candidate=%r: %s", cand[:200], e)

    for cand in candidates:
        try:
            if _fuzzy_contains(cand, CHITCHAT_HINTS, cutoff=0.82):
                logger.debug("classify_message: matched chitchat candidate=%r", cand[:200])
                return "chitchat"
        except Exception as e:
            logger.exception("classify_message: chitchat fuzzy error on candidate=%r: %s", cand[:200], e)

    try:
        single_words = set()
        for h in ALLOWED_HINTS:
            for part in h.split():
                single_words.add(part.lower())
        tokens = re.findall(r"[a-zA-Z]+", raw.lower())
        for tok in tokens:
            if tok in single_words:
                logger.debug("classify_message: token exact match -> fabric token=%r", tok)
                return "fabric"
            for hw in single_words:
                if difflib.SequenceMatcher(None, tok, hw).ratio() >= 0.78:
                    logger.debug("classify_message: token fuzzy match -> fabric tok=%r hint=%r ratio>=0.78", tok, hw)
                    return "fabric"
    except Exception as e:
        logger.exception("classify_message: token-level check failed: %s", e)

    try:
        m = re.search(r'[:\-]\s*(.+)$', raw)
        if m:
            trailing = m.group(1).strip().lower()
            if trailing and _fuzzy_contains(trailing, ALLOWED_HINTS, cutoff=0.70):
                logger.debug("classify_message: matched fabric in trailing segment=%r", trailing[:200])
                return "fabric"
    except Exception:
        pass

    logger.debug("classify_message: classified as blocked; raw=%r; normalized=%r; cleaned=%r", raw[:200], normalized[:200], cleaned[:200])
    return "blocked"


MAX_MESSAGES = 30
MAX_TOTAL_CHARS = 20000


def _extract_text_from_message_item(item: Any) -> Optional[str]:
    if item is None:
        return None
    try:
        if isinstance(item, dict) and "content" in item and item["content"] is not None:
            return str(item["content"])
    except Exception:
        pass
    try:
        content_attr = getattr(item, "content", None)
        if content_attr is not None:
            return str(content_attr)
    except Exception:
        pass
    try:
        s = str(item)
        m = re.search(r"content=(?:'|\")(?P<c>.*?)(?:'|\")", s, re.DOTALL)
        if m:
            return m.group("c")
    except Exception:
        pass
    try:
        s = str(item).strip()
        return s if s else None
    except Exception:
        return None


def _to_jsonable(v):
    if v is None or isinstance(v, (str, int, float, bool)):
        return v
    if isinstance(v, (list, tuple, set)):
        return [_to_jsonable(x) for x in v]
    if isinstance(v, dict):
        return {str(k): _to_jsonable(val) for k, val in v.items()}
    if isinstance(v, (bytes, bytearray)):
        try:
            return v.decode("utf-8", errors="replace")
        except Exception:
            return repr(v)
    try:
        return str(v)
    except Exception:
        return repr(v)


def _extract_embedded_payload(s: str) -> Optional[Dict[str, Any]]:
    if not s:
        return None
    m = re.search(r"```json\s*([\s\S]*?)```", s, re.IGNORECASE)
    if m:
        try:
            obj = json.loads(m.group(1))
            if isinstance(obj, dict):
                return obj
        except Exception:
            pass
    m = re.search(r"text=(?:'|\")({[\s\S]*})(?:'|\")", s)
    if m:
        candidate = m.group(1).replace(r"\n", "\n").replace(r"\"", "\"").replace(r"\t", "\t")
        try:
            obj = json.loads(candidate)
            if isinstance(obj, dict):
                return obj
        except Exception:
            pass
    i, j = s.find("{"), s.rfind("}")
    if i >= 0 and j > i:
        candidate = s[i:j + 1].replace(r"\n", "\n").replace(r"\"", "\"").replace(r"\t", "\t")
        try:
            obj = json.loads(candidate)
            if isinstance(obj, dict):
                return obj
        except Exception:
            pass
    return None


def _enforce_short_reply(s: str) -> str:
    if not s:
        return s
    s = s.strip()
    sentences = _re.split(r'(?<=[.!?])\s+', s)
    if sentences:
        out = sentences[0].strip()
    else:
        out = s
    max_chars = 200
    if len(out) > max_chars:
        out = out[:max_chars].rsplit(' ', 1)[0] + '...'
    if not out:
        return REFUSAL_MESSAGE
    return out.strip()


def _make_reply(text: str) -> Message:
    short = _enforce_short_reply(str(text or ""))
    if not short:
        short = REFUSAL_MESSAGE
    return Message(role="assistant", content=short)


# === History cleaner: remove previously stored broken assistant messages ===
def _clean_history(history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Remove any assistant messages that contain raw tool reprs like
    CallToolResult(...) or TextContent(...) or dictionary wrappers like {'_raw': ...}
    This prevents old broken messages from re-entering the pipeline.
    """
    cleaned = []
    for m in history:
        if m.get("role") == "assistant":
            c = str(m.get("content", "") or "")
            if "CallToolResult(" in c or "TextContent(" in c or "{'_raw':" in c or '"_raw":' in c:
                # Skip corrupted assistant message entirely
                logger.debug("Dropping corrupted assistant history message preview: %s", (c[:200] + ("..." if len(c) > 200 else "")))
                continue
        cleaned.append(m)
    return cleaned


# === Unwrap tool outputs BEFORE sanitization ===
def _unwrap_tool_result(obj: Any):
    """Unwrap CallToolResult/TextContent wrappers into clean dicts."""
    try:
        # Case 1: Direct CallToolResult(content=[TextContent(text=...)])
        if hasattr(obj, "content"):
            content = obj.content
            if isinstance(content, list) and len(content) > 0:
                first = content[0]
                if hasattr(first, "text"):
                    raw = first.text
                    try:
                        return json.loads(raw)
                    except:
                        return raw

        # Case 2: Python repr("{'_raw': CallToolResult(...) }")
        s = str(obj)
        if "{'_raw':" in s or "CallToolResult(" in s:
            # extract the first JSON-like {...}
            m = re.search(r"{[\s\S]*}", s)
            if m:
                try:
                    return json.loads(m.group(0))
                except:
                    return m.group(0)

        return obj
    except:
        return obj


# === Robust sanitizer (improved) ===
def _sanitize_agent_output_for_frontend(out: Any) -> Dict[str, Any]:
    """
    Convert agent output (dict or non-dict) into a clean dict with:
      - bot_messages: list[str]
      - reply: {"role":"assistant","content": str}
      - action/analysis_responses/results when parsable from embedded JSON
    """
    def _string_to_friendly(s: str) -> str:
        if not s:
            return ""
        s = s.strip()
        # try extract explicit JSON payload
        payload = _extract_embedded_payload(s)
        if isinstance(payload, dict):
            for k in ("display_text", "text", "message", "reply", "response"):
                if isinstance(payload.get(k), str) and payload.get(k).strip():
                    return payload.get(k).strip()
            return f"[tool result: {', '.join(sorted(payload.keys()))}]"
        # TextContent(...) pattern
        m_tc = re.search(r"TextContent\([^)]*text\s*=\s*(['\"])(?P<t>[\s\S]*?)\1", s, flags=re.IGNORECASE)
        if m_tc and m_tc.group("t"):
            inner = m_tc.group("t")
            try:
                inner_obj = json.loads(inner)
                for k in ("display_text", "text", "message", "reply", "response"):
                    if isinstance(inner_obj.get(k), str) and inner_obj.get(k).strip():
                        return inner_obj.get(k).strip()
                return f"[tool result: {', '.join(sorted(inner_obj.keys()))}]"
            except Exception:
                return inner.strip()[:1200]
        # final try: if looks like JSON blob, parse and pick best field
        if "{" in s and "}" in s:
            try:
                i = s.find("{"); j = s.rfind("}")
                candidate = s[i:j+1]
                obj = json.loads(candidate)
                if isinstance(obj, dict):
                    for k in ("display_text", "text", "message", "reply", "response"):
                        if isinstance(obj.get(k), str) and obj.get(k).strip():
                            return obj.get(k).strip()
                    return f"[tool result: {', '.join(sorted(obj.keys()))}]"
            except Exception:
                pass
        # fallback remove typical wrappers and truncate
        stripped = re.sub(r"^.*?TextContent\(|^.*?CallToolResult\(|\)$", "", s).strip()
        if not stripped:
            stripped = s
        return (stripped[:1200] + "...") if len(stripped) > 1200 else stripped

    try:
        # If out is not a dict, parse its string repr aggressively and return a friendly dict
        if not isinstance(out, dict):
            try:
                raw_str = out if isinstance(out, str) else str(out)
            except Exception:
                raw_str = repr(out)
            # first: if there's JSON embedded that decodes to dict, return that dict directly
            payload = _extract_embedded_payload(raw_str)
            if isinstance(payload, dict):
                clean = dict(payload)
                if "bot_messages" in clean and isinstance(clean["bot_messages"], str):
                    clean["bot_messages"] = [clean["bot_messages"]]
                if "reply" in clean and isinstance(clean["reply"], str):
                    clean["reply"] = {"role": "assistant", "content": clean["reply"]}
                if "bot_messages" not in clean:
                    clean["bot_messages"] = [_string_to_friendly(raw_str)]
                if "reply" not in clean:
                    friendly = _string_to_friendly(raw_str)
                    clean["reply"] = {"role": "assistant", "content": friendly}
                return clean

            # otherwise build a minimal friendly dict
            friendly = _string_to_friendly(raw_str)
            return {
                "bot_messages": [friendly],
                "reply": {"role": "assistant", "content": friendly},
                "analysis_responses": None,
                "results": None,
                "action": None,
            }

        # If out is dict: shallow-copy and sanitize fields
        clean = dict(out)
        # bot_messages => list of friendly strings
        bm = clean.get("bot_messages")
        if bm and isinstance(bm, (list, tuple)):
            nm = []
            for itm in bm:
                try:
                    s = itm if isinstance(itm, str) else str(itm)
                except Exception:
                    s = repr(itm)
                nm.append(_string_to_friendly(s))
            clean["bot_messages"] = nm
        elif isinstance(bm, str):
            clean["bot_messages"] = [_string_to_friendly(bm)]

        # reply normalization
        rep = clean.get("reply")
        if isinstance(rep, dict) and "content" in rep:
            try:
                rstr = rep.get("content") if isinstance(rep.get("content"), str) else str(rep.get("content"))
            except Exception:
                rstr = repr(rep)
            clean["reply"] = {"role": "assistant", "content": _string_to_friendly(rstr)}
        elif isinstance(rep, str):
            clean["reply"] = {"role": "assistant", "content": _string_to_friendly(rep)}
        else:
            if "reply" not in clean:
                if clean.get("bot_messages") and isinstance(clean.get("bot_messages"), list):
                    clean["reply"] = {"role": "assistant", "content": clean["bot_messages"][0]}
                else:
                    clean["reply"] = {"role": "assistant", "content": ""}

        # analysis_responses -> ensure json-friendly
        ars = clean.get("analysis_responses")
        if ars and isinstance(ars, (list, tuple)):
            new_ars = []
            for a in ars:
                if isinstance(a, dict):
                    new_ars.append(a)
                else:
                    try:
                        new_ars.append({"text": a if isinstance(a, str) else str(a)})
                    except Exception:
                        new_ars.append({"text": "[non-displayable]"})
            clean["analysis_responses"] = new_ars

        return clean

    except Exception:
        logger.exception("sanitize failure (fallback)")
        try:
            s = str(out)
        except Exception:
            s = "[unserializable agent output]"
        return {
            "bot_messages": [s[:1200] + ("..." if len(s) > 1200 else "")],
            "reply": {"role": "assistant", "content": s[:1200] + ("..." if len(s) > 1200 else "")},
            "analysis_responses": None,
            "results": None,
            "action": None,
        }
# === end sanitizer ===


def _build_response(
    reply_msg: Message,
    bot_messages,
    analysis_responses,
    results,
    action_obj,
    ask_more_flag: bool,
    reply_text: Optional[str] = None,
    force_long: bool = False,
):
    try:
        ask_more_prompt = "Would you like to know more about this?" if ask_more_flag else None
        content = (getattr(reply_msg, "content", "") or "").strip()
        if not content:
            content = (reply_text or "").strip() or "..."
        if ask_more_flag and not force_long:
            low = content.lower()
            if ("would you like to know more" not in low and "want to know more" not in low and "would you like more" not in low):
                content = content + "\n\nWould you like to know more?"
        final_reply = Message(role="assistant", content=content)

        bot_messages_list: List[str] = []
        if bot_messages and isinstance(bot_messages, (list, tuple)) and len(bot_messages) > 0:
            for b in bot_messages:
                try:
                    bot_messages_list.append(str(b))
                except Exception:
                    bot_messages_list.append(json.dumps(b, default=str))
        else:
            bot_messages_list = [reply_text or content]

        bot_messages_list[0] = content
        bot_messages_json = _to_jsonable(bot_messages_list)

        logger.info("CHAT_RESPONSE ready: ask_more=%s ask_more_prompt=%s reply_preview=%s", ask_more_flag, ask_more_prompt, (content[:240] + ("..." if len(content) > 240 else "")))

        return ChatResponse(
            reply=final_reply,
            action=action_obj,
            bot_messages=bot_messages_json,
            analysis_responses=_to_jsonable(analysis_responses) if analysis_responses else None,
            results=_to_jsonable(results) if results else None,
            ask_more=ask_more_flag,
            ask_more_prompt=ask_more_prompt,
        )
    except Exception as e:
        logger.exception("Error in _build_response: %s", e)
        safe_reply = Message(role="assistant", content="Sorry — something went wrong preparing the reply.")
        return ChatResponse(reply=safe_reply, ask_more=False)


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(body: ChatRequest):
    if not body.messages:
        raise HTTPException(status_code=400, detail="messages[] cannot be empty.")

    last_user: Optional[str] = None
    for m in reversed(body.messages):
        if m.role == "user":
            last_user = m.content
            break
    if not last_user:
        raise HTTPException(status_code=400, detail="Need at least one user message.")

    force_long = False
    try:
        lower_last_user = (last_user or "").strip().lower()
        ask_more_idx = None
        for idx in range(len(body.messages) - 1, -1, -1):
            m = body.messages[idx]
            if (m.role == "assistant" and isinstance(m.content, str) and "would you like to know more" in m.content.lower()):
                ask_more_idx = idx
                break
        original_user = None
        if ask_more_idx is not None:
            for j in range(ask_more_idx - 1, -1, -1):
                prev = body.messages[j]
                if prev.role == "user" and isinstance(prev.content, str) and prev.content.strip():
                    original_user = prev.content.strip()
                    break
        yes_tokens = {"yes", "yeah", "y", "sure", "ok", "okay", "yep", "surely", "please", "more", "tell me more", "details"}
        if ask_more_idx is not None and lower_last_user in yes_tokens:
            if original_user:
                forced = f"Please provide a detailed answer: {original_user}"
                logger.info("YES-click detected (explicit). Forcing detailed question -> %s", forced)
                last_user = forced
                category = "fabric"
                force_long = True
            else:
                category = classify_message(last_user)
        else:
            if ask_more_idx is not None and original_user:
                try:
                    if lower_last_user == original_user.strip().lower():
                        forced = f"Please provide a detailed answer: {original_user}"
                        logger.info("YES-click detected (heuristic: repeated question exact match). Forcing detailed question -> %s", forced)
                        last_user = forced
                        category = "fabric"
                        force_long = True
                    else:
                        user_tokens = set(re.findall(r"[a-zA-Z]+", lower_last_user))
                        orig_tokens = set(re.findall(r"[a-zA-Z]+", original_user.strip().lower()))
                        if user_tokens and orig_tokens:
                            intersect = len(user_tokens & orig_tokens)
                            union = len(user_tokens | orig_tokens)
                            ratio = float(intersect) / float(union) if union > 0 else 0.0
                            if ratio >= 0.85:
                                forced = f"Please provide a detailed answer: {original_user}"
                                logger.info("YES-click detected (heuristic: repeated question fuzzy match ratio=%.2f). Forcing detailed question -> %s", ratio, forced)
                                last_user = forced
                                category = "fabric"
                                force_long = True
                            else:
                                category = classify_message(last_user)
                        else:
                            category = classify_message(last_user)
                except Exception as e:
                    logger.exception("Error in repeated-question heuristic: %s", e)
                    category = classify_message(last_user)
            else:
                category = classify_message(last_user)
    except Exception as e:
        logger.exception("Error in yes-flow override: %s", e)
        category = classify_message(last_user)

    if category == "blocked":
        return _build_response(_make_reply(REFUSAL_MESSAGE), None, None, None, None, False, REFUSAL_MESSAGE, force_long)
    if category == "chitchat":
        return _build_response(_make_reply(CHITCHAT_RESPONSE), None, None, None, None, False, CHITCHAT_RESPONSE, force_long)

    if len(body.messages) > MAX_MESSAGES:
        raise HTTPException(status_code=400, detail=f"Too many messages (>{MAX_MESSAGES}).")
    total_len = sum(len(m.content) for m in body.messages)
    if total_len > MAX_TOTAL_CHARS:
        raise HTTPException(status_code=400, detail="Conversation too long for this endpoint.")

    # Build messages_payload and CLEAN history from corrupted assistant messages
    messages_payload = [m.model_dump() for m in body.messages]
    messages_payload = _clean_history(messages_payload)

    if not any(m["role"] == "system" for m in messages_payload):
        messages_payload = [{"role": "system", "content": SYSTEM_PROMPT}] + messages_payload

    try:
        mode_var = "long" if force_long else "short"
        try:
            import pprint
            logger.info("CHAT DEBUG -> mode_var=%s force_long=%s last_user_preview=%s", mode_var, force_long, (last_user or "")[:200])
            preview_msgs = []
            for m in messages_payload[-10:]:
                preview_msgs.append({"role": m.get("role"), "content_preview": (str(m.get("content") or "")[:120])})
            logger.info("CHAT DEBUG -> messages_payload_preview: %s", pprint.pformat(preview_msgs))
        except Exception:
            logger.exception("CHAT DEBUG -> Failed to log debug payload")

        if agent_graph is None:
            logger.error("agent_graph is None — cannot call agent_graph.invoke. Ensure agent.graph is present.")
            return _build_response(_make_reply("Sorry — the analysis engine is unavailable."), None, None, None, None, False, "Sorry — the analysis engine is unavailable.", force_long)

        # Call agent_graph and sanitize its output immediately
        raw_result = agent_graph.invoke({"text": last_user, "history": messages_payload[-10:], "mode": mode_var})
        logger.debug("RAW_AGENT_RESULT preview: %s", str(raw_result)[:1800])

        unwrapped_result = _unwrap_tool_result(raw_result)
        result = _sanitize_agent_output_for_frontend(unwrapped_result)

    except Exception as e:
        logger.exception("Agent graph invocation failed")
        raise HTTPException(status_code=502, detail=f"Agent error: {str(e)}")

    # result is sanitized dict-like (or convertible) now
    if isinstance(result, dict):
        out = result
        try:
            raw_bot_messages = out.get("bot_messages")
            if raw_bot_messages and isinstance(raw_bot_messages, (list, tuple)) and len(raw_bot_messages) > 0:
                first = raw_bot_messages[0]
                sfirst = first if isinstance(first, str) else str(first)
                payload = _extract_embedded_payload(sfirst)
                if isinstance(payload, dict):
                    if payload.get("action"):
                        out["action"] = payload.get("action")
                    if payload.get("analysis_responses"):
                        out["analysis_responses"] = payload.get("analysis_responses")
                    if payload.get("bot_messages"):
                        out["bot_messages"] = payload.get("bot_messages")
                    elif isinstance(payload.get("text"), str):
                        out["bot_messages"] = [payload.get("text")] + (out.get("bot_messages") or [])[1:]
                    elif isinstance(payload.get("display_text"), str):
                        out["bot_messages"] = [payload.get("display_text")] + (out.get("bot_messages") or [])[1:]
        except Exception:
            logger.exception("Failed to normalize raw bot_messages / extract embedded payload from dict result")

        results = out.get("results")
        bot_messages = out.get("bot_messages") or []
        action = out.get("action")
        analysis_responses = out.get("analysis_responses")

        reply_text = None
        if bot_messages and isinstance(bot_messages, (list, tuple)) and bot_messages:
            first = bot_messages[0]
            sfirst = first if isinstance(first, str) else str(first)
            payload_candidate = _extract_embedded_payload(sfirst)
            if isinstance(payload_candidate, dict) and isinstance(payload_candidate.get("text"), str):
                reply_text = payload_candidate.get("text")
            else:
                reply_text = str(sfirst)
        elif analysis_responses and isinstance(analysis_responses, (list, tuple)) and analysis_responses:
            first = analysis_responses[0]
            if isinstance(first, dict):
                reply_text = first.get("text") or first.get("response") or str(first)
            else:
                reply_text = str(first)
        else:
            reply_text = out.get("message") or out.get("reply") or out.get("text") or str(out)

        if force_long:
            try:
                reply = Message(role="assistant", content=str(reply_text or ""))
            except Exception:
                reply = _make_reply(reply_text)
        else:
            reply = _make_reply(reply_text)

        action_obj = None
        if action and isinstance(action, dict) and action.get("type"):
            try:
                clean_params = _to_jsonable(action.get("params", {}))
                action_obj = Action(type=action["type"], params=clean_params)
            except Exception:
                action_obj = None

        try:
            has_text_reply = bool(reply_text and str(reply_text).strip())
            no_action = not action
            no_analysis = not analysis_responses
            ask_more_flag = True if (category == "fabric" and has_text_reply and no_action and no_analysis) else False
        except Exception:
            ask_more_flag = False

        return _build_response(reply, bot_messages, analysis_responses, results, action_obj, ask_more_flag, reply_text, force_long)

    # fallback generic handling (should rarely happen)
    try:
        reply = _make_reply(str(result))
    except Exception:
        reply = _make_reply("Sorry — something went wrong.")
    return _build_response(reply, None, None, None, None, False, None, force_long)
