# routes/chat.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Dict, Any
import re
import json
import logging

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
    # allow media action too so it isn't dropped by validation
    type: Literal["redirect_to_analysis", "redirect_to_media_analysis"]
    params: Dict[str, Any]

class ChatResponse(BaseModel):
    reply: Message
    action: Optional[Action] = None
    bot_messages: Optional[List[str]] = None
    analysis_responses: Optional[List[Dict[str, Any]]] = None

ALLOWED_HINTS = [
    "fabric","textile","cloth","garment","apparel","yarn","fiber","fibre","cotton","polyester",
    "silk","wool","linen","denim","viscose","rayon","nylon","spandex","elastane","acrylic",
    "gsm","weave","warp","weft","fill","knit","woven","nonwoven","loom","twill","satin","plain weave",
    "dye","dyeing","printing","finishing","bleach","wash","shrink","shrinkage","pilling","drape",
    "handfeel","tensile","tear","colorfastness","martindale","abrasion","stretch","recovery",
    "microfiber","blend","weft knit","warp knit","rib","jersey","interlock","felting",
    "care","wash care","ironing","detergent","stain","test","testing",
    "analysis","analyser","analyzer","upload","image","model","tagging","feature","chatbot","ui","ux"
]

CHITCHAT_HINTS = [
    "hi", "hello", "hey", "good morning", "good evening",
    "how are you", "what can you do", "help", "thanks", "thank you"
]

REFUSAL_MESSAGE = (
    "❌ I can only answer **fabric/textile** questions or **how to use this app**.\n\n"
    "Try asking things like:\n"
    "• Difference between knit and woven\n"
    "• What is GSM and how is it measured?\n"
    "• How to use the image analysis feature here"
)

CHITCHAT_RESPONSE = (
    "👋 Hi there! I’m your Fabric Finder assistant. "
    "I can help you with fabrics, textiles, and how to use this app. "
    "Ask me about weave, knit, GSM, fibers, or try uploading an image for analysis!"
)

def classify_message(user_text: str) -> str:
    t = (user_text or "").lower()
    if any(h in t for h in ALLOWED_HINTS):
        return "fabric"
    if any(h in t for h in CHITCHAT_HINTS):
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
        candidate = s[i:j+1].replace(r"\n", "\n").replace(r"\"", "\"").replace(r"\t", "\t")
        try:
            obj = json.loads(candidate)
            if isinstance(obj, dict):
                return obj
        except Exception:
            pass

    return None

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

    if category == "blocked":
        reply = Message(role="assistant", content=REFUSAL_MESSAGE)
        return ChatResponse(reply=reply)

    if category == "chitchat":
        reply = Message(role="assistant", content=CHITCHAT_RESPONSE)
        return ChatResponse(reply=reply)

    if len(body.messages) > MAX_MESSAGES:
        raise HTTPException(status_code=400, detail=f"Too many messages (>{MAX_MESSAGES}).")
    total_len = sum(len(m.content) for m in body.messages)
    if total_len > MAX_TOTAL_CHARS:
        raise HTTPException(status_code=400, detail="Conversation too long for this endpoint.")

    messages_payload = [m.model_dump() for m in body.messages]
    if not any(m["role"] == "system" for m in messages_payload):
        messages_payload = [{"role": "system", "content": SYSTEM_PROMPT}] + messages_payload

    try:
        result = agent_graph.invoke(last_user)
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

        reply = Message(role="assistant", content=str(reply_text))

        action_obj = None
        if action and isinstance(action, dict) and action.get("type"):
            try:
                clean_params = _to_jsonable(action.get("params", {}))  # sanitize params
                action_obj = Action(type=action["type"], params=clean_params)
            except Exception:
                action_obj = None

        return ChatResponse(
            reply=reply,
            action=action_obj,
            bot_messages=_to_jsonable(bot_messages) if bot_messages else ([reply_text] if reply_text else None),
            analysis_responses=_to_jsonable(analysis_responses) if analysis_responses else None,
            results=_to_jsonable(results) if results else None
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

            return ChatResponse(
                reply=Message(role="assistant", content=str(bot_messages[0] if bot_messages else reply_text)),
                action=action_obj,
                bot_messages=_to_jsonable(bot_messages) if isinstance(bot_messages, list) else None,
                analysis_responses=_to_jsonable(analysis_responses) if isinstance(analysis_responses, list) else None,
            )

        # fallback: conversational only
        reply = Message(role="assistant", content=str(reply_text))
        return ChatResponse(reply=reply)

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

        return ChatResponse(
            reply=Message(role="assistant", content=str(bot_messages[0] if bot_messages else reply_text)),
            action=action_obj,
            bot_messages=_to_jsonable(bot_messages) if isinstance(bot_messages, list) else None,
            analysis_responses=_to_jsonable(analysis_responses) if isinstance(analysis_responses, list) else None,
        )

    reply = Message(role="assistant", content=str(reply_text))
    return ChatResponse(reply=reply)
