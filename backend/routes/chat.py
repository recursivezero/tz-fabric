# chat.py  (FULL updated file)
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Dict, Any
import re
import json
import logging
import difflib
import re as _re

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])

from agent.graph import agent_graph, SYSTEM_PROMPT

Role = Literal["user", "assistant", "system"]


class Message(BaseModel):
    role: Role
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    messages: List[Message]


class Action(BaseModel):
    # include 'search' as well
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

    # fast exact substring
    for h in hints:
        if h in t:
            return True

    # tokenize words (alpha tokens)
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

    # compare full text to hint (covers multi-word queries)
    for h in hints:
        if difflib.SequenceMatcher(None, t, h).ratio() >= cutoff:
            return True

    return False


# ---- New helper: conservative typo normalization ----
def _normalize_for_typos(text: str, hints: List[str], min_ratio: float = 0.80) -> str:
    """
    Replace individual alpha tokens in `text` with the closest matching hint word
    if the similarity ratio is >= min_ratio. Returns a normalized text string.
    Conservative: only replaces tokens when there's a confident single-word match.
    """
    if not text:
        return text
    # build single-word hint set for matching (split multi-word hints into parts too)
    single_words = set()
    for h in hints:
        for part in h.split():
            single_words.add(part.lower())
    single_words = sorted(single_words)

    tokens = re.findall(r"[a-zA-Z]+", text)
    if not tokens:
        return text

    normalized = text
    # For each token, try to find a close hint match
    for tok in set(tokens):  # unique tokens to reduce work
        lower_tok = tok.lower()
        # exact match: skip
        if lower_tok in single_words:
            continue
        # try close matches
        matches = difflib.get_close_matches(lower_tok, single_words, n=1, cutoff=min_ratio)
        if matches:
            best = matches[0]
            # Replace whole-word occurrences of the token in the original text (case-insensitive)
            normalized = re.sub(rf'\b{re.escape(tok)}\b', best, normalized, flags=re.IGNORECASE)
    return normalized
# ----------------------------------------------------




def classify_message(user_text: str) -> str:
    raw = (user_text or "").strip()
    if not raw:
        logger.debug("classify_message: empty input -> blocked")
        return "blocked"

    all_hints = ALLOWED_HINTS + CHITCHAT_HINTS

    # 1) Try conservative typo-normalization (keeps original if it fails)
    try:
        normalized = _normalize_for_typos(raw, all_hints, min_ratio=0.80)
    except Exception:
        normalized = raw

    # 2) Strip wrappers like "Please provide a detailed answer: ..." and similar
    def _strip_detailed_wrappers_local(text: str) -> str:
        s = (text or "").strip()
        if not s:
            return s
        # Leading wrappers
        s = re.sub(
            r'(?i)^\s*(please\s+(provide|give|share)\s+(me\s+)?(a\s+)?|(please\s+)?)(detailed|long|full|comprehensive|in[-\s]?depth|extended|detailed answer|long answer|detailed reply|detailed response)\b[:\-\s]*',
            '',
            s,
        ).strip()
        s = re.sub(r'(?i)^\s*(detailed|long|full|in[-\s]?depth)\s*[:\-\s]+', '', s).strip()
        # Trailing wrappers
        s = re.sub(r'(?i)\s*\(\s*(detailed|long|full|in[-\s]?depth)\s*\)\s*$', '', s).strip()
        s = re.sub(r'(?i)\s*[-–—]\s*(detailed|long|full|in[-\s]?depth)\s*$', '', s).strip()
        # simple trailing words
        s = re.sub(r'(?i)\s*\b(detailed|long)\b\s*$', '', s).strip()
        return s or text

    try:
        cleaned = _strip_detailed_wrappers_local(normalized)
    except Exception:
        cleaned = normalized

    # 3) Prepare candidate strings to test (prefer cleaned, then normalized, then raw)
    candidates = []
    if isinstance(cleaned, str) and cleaned.strip():
        candidates.append(cleaned.strip().lower())
    if isinstance(normalized, str) and normalized.strip() and normalized.strip().lower() not in candidates:
        candidates.append(normalized.strip().lower())
    if raw.strip().lower() not in candidates:
        candidates.append(raw.strip().lower())

    # 4) Core fuzzy check for fabric (try each candidate)
    for cand in candidates:
        try:
            if _fuzzy_contains(cand, ALLOWED_HINTS, cutoff=0.72):
                logger.debug("classify_message: matched fabric candidate=%r", cand[:200])
                return "fabric"
        except Exception as e:
            logger.exception("classify_message: _fuzzy_contains error on candidate=%r: %s", cand[:200], e)

    # 5) Chitchat check (slightly stricter)
    for cand in candidates:
        try:
            if _fuzzy_contains(cand, CHITCHAT_HINTS, cutoff=0.82):
                logger.debug("classify_message: matched chitchat candidate=%r", cand[:200])
                return "chitchat"
        except Exception as e:
            logger.exception("classify_message: chitchat fuzzy error on candidate=%r: %s", cand[:200], e)

    # 6) Last-resort token-level fuzzy matching: check tokens against single-word hints
    try:
        # build single-word hint list
        single_words = set()
        for h in ALLOWED_HINTS:
            for part in h.split():
                single_words.add(part.lower())

        tokens = re.findall(r"[a-zA-Z]+", raw.lower())
        for tok in tokens:
            # exact
            if tok in single_words:
                logger.debug("classify_message: token exact match -> fabric token=%r", tok)
                return "fabric"
            # fuzzy token match (lower threshold)
            for hw in single_words:
                if difflib.SequenceMatcher(None, tok, hw).ratio() >= 0.78:
                    logger.debug("classify_message: token fuzzy match -> fabric tok=%r hint=%r ratio>=0.78", tok, hw)
                    return "fabric"
    except Exception as e:
        logger.exception("classify_message: token-level check failed: %s", e)

    # 7) Extra heuristic: try to extract text after colon if message was a wrapper
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

# ---- Replace/enforce short replies ----
def _enforce_short_reply(s: str) -> str:
    if not s:
        return s
    s = s.strip()
    # split into sentences (heuristic) and keep only the first sentence
    sentences = _re.split(r'(?<=[.!?])\s+', s)
    if sentences:
        out = sentences[0].strip()
    else:
        out = s
    # enforce much shorter maximum
    max_chars = 200
    if len(out) > max_chars:
        out = out[:max_chars].rsplit(' ', 1)[0] + '...'
    # final safety: if it's empty return exact refusal fallback
    if not out:
        return REFUSAL_MESSAGE
    return out.strip()
# ----------------------------------------------------

def _make_reply(text: str) -> Message:
    short = _enforce_short_reply(str(text or ""))
    if not short:
        short = REFUSAL_MESSAGE
    return Message(role="assistant", content=short)



def _build_response(
    reply_msg: Message,
    bot_messages,
    analysis_responses,
    results,
    action_obj,
    ask_more_flag: bool,
    reply_text: Optional[str] = None,
):
    try:
        # Human-friendly prompt text exposed to the frontend
        ask_more_prompt = "Would you like to know more about this?" if ask_more_flag else None

        # Start from reply_msg.content (fallback to reply_text)
        content = (getattr(reply_msg, "content", "") or "").strip()
        if not content:
            content = (reply_text or "").strip() or "..."

        # If backend intends to ask for more, append the sentence only if it's not already present.
        if ask_more_flag:
            low = content.lower()
            if (
                "would you like to know more" not in low
                and "want to know more" not in low
                and "would you like more" not in low
            ):
                # add a new paragraph for clarity
                content = content + "\n\nWould you like to know more?"

        # Build the final Message object (ensures pydantic validation)
        final_reply = Message(role="assistant", content=content)

        # Normalize bot_messages into a list of strings the frontend can use.
        bot_messages_list: List[str] = []
        if bot_messages and isinstance(bot_messages, (list, tuple)) and len(bot_messages) > 0:
            for b in bot_messages:
                try:
                    bot_messages_list.append(str(b))
                except Exception:
                    bot_messages_list.append(json.dumps(b, default=str))
        else:
            # Fallback: present the reply text as the only bot message
            bot_messages_list = [reply_text or content]

        # Ensure the first visible bot_message equals the final visible content (with appended prompt)
        # This ensures frontend sees the same text for quick-reply logic and visual display.
        bot_messages_list[0] = content

        bot_messages_json = _to_jsonable(bot_messages_list)

        logger.info(
            "CHAT_RESPONSE ready: ask_more=%s ask_more_prompt=%s reply_preview=%s",
            ask_more_flag,
            ask_more_prompt,
            (content[:240] + ("..." if len(content) > 240 else "")),
        )

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

    # ---------- NEW: handle YES-after-ask-more override ----------
    try:
        lower_last_user = (last_user or "").strip().lower()

        # Detect if the last assistant message asked "Would you like to know more?"
        ask_more_idx = None
        for idx in range(len(body.messages) - 1, -1, -1):
            m = body.messages[idx]
            if (
                m.role == "assistant"
                and isinstance(m.content, str)
                and "would you like to know more" in m.content.lower()
            ):
                ask_more_idx = idx
                break

        # If user replied with a simple Yes after that prompt, upgrade to detailed fetch
        if ask_more_idx is not None and lower_last_user in ["yes", "yeah", "y", "sure", "ok", "okay"]:
            # Find the original fabric question (one user turn BEFORE the ask-more message)
            original_user = None
            for j in range(ask_more_idx - 1, -1, -1):
                prev = body.messages[j]
                if prev.role == "user" and isinstance(prev.content, str) and prev.content.strip():
                    original_user = prev.content.strip()
                    break

            if original_user:
                # Force the backend to treat this as a detailed fabric request
                forced = f"Please provide a detailed answer: {original_user}"
                logger.info("YES-click detected. Forcing detailed question -> %s", forced)
                last_user = forced
                # classify as fabric to avoid refusal
                category = "fabric"
            else:
                # No preceding user message found; keep as-is (will be classified normally)
                category = classify_message(last_user)
        else:
            # Not the special yes-case -> normal classification
            category = classify_message(last_user)
    except Exception as e:
        logger.exception("Error in yes-flow override: %s", e)
        # fallback to normal classification
        category = classify_message(last_user)

    if category == "blocked":
      return _build_response(_make_reply(REFUSAL_MESSAGE), None, None, None, None, False, REFUSAL_MESSAGE)

    if category == "chitchat":
      return _build_response(_make_reply(CHITCHAT_RESPONSE), None, None, None, None, False, CHITCHAT_RESPONSE)

    if len(body.messages) > MAX_MESSAGES:
        raise HTTPException(status_code=400, detail=f"Too many messages (>{MAX_MESSAGES}).")
    total_len = sum(len(m.content) for m in body.messages)
    if total_len > MAX_TOTAL_CHARS:
        raise HTTPException(status_code=400, detail="Conversation too long for this endpoint.")

    messages_payload = [m.model_dump() for m in body.messages]
    for i in range(len(messages_payload)-1, -1, -1):
        if messages_payload[i].get("role") == "user":
            messages_payload[i]["content"] = last_user
            break

    if not any(m["role"] == "system" for m in messages_payload):
        messages_payload = [{"role": "system", "content": SYSTEM_PROMPT}] + messages_payload

    try:
        result = agent_graph.invoke({"text": last_user, "history": messages_payload[-10:]})
    except Exception as e:
        logger.exception("Agent graph invocation failed")
        raise HTTPException(status_code=502, detail=f"Agent error: {str(e)}")

    if isinstance(result, dict):
        out = result

        results = out.get("results")

        bot_messages = out.get("bot_messages") or []
        action = out.get("action")
        analysis_responses = out.get("analysis_responses")

        reply_text = None
        if bot_messages and isinstance(bot_messages, (list, tuple)) and bot_messages:
            reply_text = str(bot_messages[0])
        elif analysis_responses and isinstance(analysis_responses, (list, tuple)) and analysis_responses:
            first = analysis_responses[0]
            if isinstance(first, dict):
                reply_text = first.get("text") or first.get("response") or str(first)
            else:
                reply_text = str(first)
        else:
            reply_text = out.get("message") or out.get("reply") or out.get("text") or str(out)

        reply = _make_reply(reply_text)

        action_obj = None
        if action and isinstance(action, dict) and action.get("type"):
            try:
                clean_params = _to_jsonable(action.get("params", {}))  # sanitize params
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

        return _build_response(reply, bot_messages, analysis_responses, results, action_obj, ask_more_flag, reply_text)

    if isinstance(result, list):
        texts = []
        for item in result:
            txt = _extract_text_from_message_item(item)
            if txt:
                texts.append(txt)
        reply_text = texts[-1] if texts else str(result)

        payload = _extract_embedded_payload("\n".join([t for t in texts if t]))
        if isinstance(payload, dict):
            action = payload.get("action")
            analysis_responses = payload.get("analysis_responses")
            bot_messages = payload.get("bot_messages")

            action_obj = None
            if isinstance(action, dict) and action.get("type"):
                try:
                    action_obj = Action(
                        type=action["type"],
                        params=_to_jsonable(action.get("params", {})),  # sanitize
                    )
                except Exception:
                    action_obj = None

            try:
                has_text_reply = bool(reply_text and str(reply_text).strip())
                no_action = not action
                no_analysis = not analysis_responses
                ask_more_flag = True if (category == "fabric" and has_text_reply and no_action and no_analysis) else False
            except Exception:
                ask_more_flag = False

            reply_msg = _make_reply(bot_messages[0] if bot_messages else reply_text)

            return _build_response(reply_msg, bot_messages, analysis_responses, None, action_obj, ask_more_flag, reply_text)

        reply = _make_reply(reply_text)
        try:
            has_text_reply = bool(reply_text and str(reply_text).strip())
            ask_more_flag = True if (category == "fabric" and has_text_reply and not None and True) else False
        except Exception:
            ask_more_flag = False

        return _build_response(reply, None, None, None, None, ask_more_flag, reply_text)

    potential = _extract_text_from_message_item(result)
    reply_text = potential if potential else str(result)

    payload = _extract_embedded_payload(reply_text)
    if isinstance(payload, dict):
        action = payload.get("action")
        analysis_responses = payload.get("analysis_responses")
        bot_messages = payload.get("bot_messages")

        action_obj = None
        if isinstance(action, dict) and action.get("type"):
            try:
                action_obj = Action(
                    type=action["type"],
                    params=_to_jsonable(action.get("params", {})),  # sanitize
                )
            except Exception:
                action_obj = None

        try:
            has_text_reply = bool(reply_text and str(reply_text).strip())
            no_action = not action
            no_analysis = not analysis_responses
            ask_more_flag = True if (category == "fabric" and has_text_reply and no_action and no_analysis) else False
        except Exception:
            ask_more_flag = False

        reply_msg = _make_reply(bot_messages[0] if bot_messages else reply_text)

        return _build_response(reply_msg, bot_messages, analysis_responses, None, action_obj, ask_more_flag, reply_text)

    reply = _make_reply(reply_text if reply_text is not None else "")

    try:
        has_text_reply = bool(reply_text and str(reply_text).strip())
        ask_more_flag = True if (category == "fabric" and has_text_reply and not None and True) else False
    except Exception:
        ask_more_flag = False
    return _build_response(reply, None, None, None, None, ask_more_flag, reply_text)
