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
    ask_more: Optional[bool] = None  # <-- ADDED: backend indicates whether to show "Would you like to know more?"


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
    # conservative typo-normalization using both allowed and chitchat hints
    all_hints = ALLOWED_HINTS + CHITCHAT_HINTS
    try:
        normalized = _normalize_for_typos(raw, all_hints, min_ratio=0.80)
    except Exception:
        normalized = raw
    t = normalized.lower()
    # fabric detection (tolerant to typos)
    if _fuzzy_contains(t, ALLOWED_HINTS, cutoff=0.72):
        return "fabric"
    # chitchat slightly stricter
    if _fuzzy_contains(t, CHITCHAT_HINTS, cutoff=0.82):
        return "chitchat"
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

    category = classify_message(last_user)

    # If the conversation history contains an assistant prompt asking "Would you like to know more"
    # and the current user message is the same as an earlier user question (the original),
    # treat this as the user's confirmation to get a detailed answer.
    try:
        lower_last_user = (last_user or "").strip().lower()
        # find last assistant "would you like to know more" occurrence (if any)
        assistant_msgs = [m for m in body.messages if m.role == "assistant" and isinstance(m.content, str)]
        ask_more_idx = None
        for idx in range(len(body.messages)-1, -1, -1):
            m = body.messages[idx]
            if m.role == "assistant" and isinstance(m.content, str) and "would you like to know more" in m.content.lower():
                ask_more_idx = idx
                break
        if ask_more_idx is not None:
            # find the original user question prior to that assistant message (scan backwards)
            original_user = None
            for j in range(ask_more_idx - 1, -1, -1):
                mm = body.messages[j]
                if mm.role == "user" and isinstance(mm.content, str):
                    original_user = mm.content.strip()
                    break
            if original_user and original_user.strip().lower() == lower_last_user:
                # detected a 'Yes' follow-up (frontend resends original). Request a long/detailed answer.
                # We modify last_user to explicitly indicate long/detailed mode. This is stateless and safe.
                last_user = "Please provide a detailed answer: " + (last_user or "")
                # Also adjust category in case normalization matters
                category = classify_message(last_user)
    except Exception:
        # non-fatal; continue normally if anything goes wrong
        pass

    if category == "blocked":
      return ChatResponse(reply=_make_reply(REFUSAL_MESSAGE), ask_more=False)

    if category == "chitchat":
      return ChatResponse(reply=_make_reply(CHITCHAT_RESPONSE), ask_more=False)

    if len(body.messages) > MAX_MESSAGES:
        raise HTTPException(status_code=400, detail=f"Too many messages (>{MAX_MESSAGES}).")
    total_len = sum(len(m.content) for m in body.messages)
    if total_len > MAX_TOTAL_CHARS:
        raise HTTPException(status_code=400, detail="Conversation too long for this endpoint.")

    # rebuild messages_payload but ensure we include the (possibly rewritten) last_user as the final user turn
    messages_payload = [m.model_dump() for m in body.messages]
    # replace the last user content in payload (the last occurrence of role==user)
    for i in range(len(messages_payload)-1, -1, -1):
        if messages_payload[i].get("role") == "user":
            messages_payload[i]["content"] = last_user
            break

    if not any(m["role"] == "system" for m in messages_payload):
        messages_payload = [{"role": "system", "content": SYSTEM_PROMPT}] + messages_payload

    try:
        # Pass text + a short history for better fallback grounding
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

        # compute ask_more: only for fabric textual answers with no action and no analysis_responses
        try:
            has_text_reply = bool(reply_text and str(reply_text).strip())
            no_action = not action
            no_analysis = not analysis_responses
            ask_more_flag = True if (category == "fabric" and has_text_reply and no_action and no_analysis) else False
        except Exception:
            ask_more_flag = False

        return ChatResponse(
            reply=reply,
            action=action_obj,
            bot_messages=_to_jsonable(bot_messages) if bot_messages else ([reply_text] if reply_text else None),
            analysis_responses=_to_jsonable(analysis_responses) if analysis_responses else None,
            results=_to_jsonable(results) if results else None,
            ask_more=ask_more_flag,
        )

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

            # compute ask_more from payload-derived values
            try:
                has_text_reply = bool(reply_text and str(reply_text).strip())
                no_action = not action
                no_analysis = not analysis_responses
                ask_more_flag = True if (category == "fabric" and has_text_reply and no_action and no_analysis) else False
            except Exception:
                ask_more_flag = False

            return ChatResponse(
                reply=Message(role="assistant", content=str(bot_messages[0] if bot_messages else reply_text)),
                action=action_obj,
                bot_messages=_to_jsonable(bot_messages) if isinstance(bot_messages, list) else None,
                analysis_responses=_to_jsonable(analysis_responses) if isinstance(analysis_responses, list) else None,
                ask_more=ask_more_flag,
            )

        reply = _make_reply(reply_text)
        try:
            has_text_reply = bool(reply_text and str(reply_text).strip())
            ask_more_flag = True if (category == "fabric" and has_text_reply and not None and True) else False
        except Exception:
            ask_more_flag = False
        return ChatResponse(reply=reply, ask_more=ask_more_flag)

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

        return ChatResponse(
            reply=Message(role="assistant", content=str(bot_messages[0] if bot_messages else reply_text)),
            action=action_obj,
            bot_messages=_to_jsonable(bot_messages) if isinstance(bot_messages, list) else None,
            analysis_responses=_to_jsonable(analysis_responses) if isinstance(analysis_responses, list) else None,
            ask_more=ask_more_flag,
        )

    reply = Message(role="assistant", content=str(reply_text))
    try:
        has_text_reply = bool(reply_text and str(reply_text).strip())
        ask_more_flag = True if (category == "fabric" and has_text_reply and not None and True) else False
    except Exception:
        ask_more_flag = False
    return ChatResponse(reply=reply, ask_more=ask_more_flag)
