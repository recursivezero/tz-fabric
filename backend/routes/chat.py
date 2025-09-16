# rotes/chat.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Dict, Any
from agent.graph import agent_graph, SYSTEM_PROMPT
import json
import re
import logging

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])

Role = Literal["user", "assistant", "system"]

class Message(BaseModel):
    role: Role
    content: str = Field(min_length=1, max_length=8000)

class ChatRequest(BaseModel):
    messages: List[Message]

class Action(BaseModel):
    type: Literal["redirect_to_analysis"]
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
    t = user_text.lower()
    if any(h in t for h in ALLOWED_HINTS):
        return "fabric"
    if any(h in t for h in CHITCHAT_HINTS):
        return "chitchat"
    return "blocked"

MAX_MESSAGES = 30
MAX_TOTAL_CHARS = 20000

def _extract_text_from_message_item(item: Any) -> Optional[str]:
    """
    Try multiple strategies to get readable text from an item that may be:
      - a dict with 'content'
      - an object with .content attribute (LangChain AIMessage)
      - a string representation like "AIMessage(content='...')"
    Returns None if no readable content found.
    """
    if item is None:
        return None
    # dict-like
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

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(body: ChatRequest):
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
        events = agent_graph.stream(
            {"messages": messages_payload},
            stream_mode="values",
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Agent error: {str(e)}")

    final = None
    for ev in events:
        final = ev

    if not final:
        raise HTTPException(status_code=502, detail="No response from agent.")

    try:
        logger.debug("Agent final type: %s", type(final))
        # attempt to pretty-print small outputs
        preview = final if isinstance(final, (str, int, float)) else str(final)[:400]
        logger.debug("Agent final preview: %s", preview)
    except Exception:
        pass

    parsed = final
    if isinstance(final, str):
        try:
            parsed = json.loads(final)
        except Exception:
            parsed = None

    if isinstance(parsed, dict) and "type" in parsed:
        resp_type = parsed.get("type")
        bot_messages = parsed.get("bot_messages", [])
        params = parsed.get("params")
        reply_text = None

        if bot_messages and isinstance(bot_messages, (list, tuple)):
            # coerce to strings and pick first
            reply_text = next((str(x) for x in bot_messages if x is not None), None)

        if not reply_text:
            reply_text = parsed.get("reply") or parsed.get("message") or None
            if isinstance(reply_text, dict):
                # try to extract content if it's a message-like dict
                reply_text = _extract_text_from_message_item(reply_text)
        # if still none, try to pull from 'messages' list
        if not reply_text and isinstance(parsed.get("messages"), (list, tuple)):
            items = parsed.get("messages", [])
            texts = [t for t in ( _extract_text_from_message_item(i) for i in items ) if t]
            if texts:
                reply_text = texts[-1]

        if not reply_text:
            reply_text = "OK."

        reply = Message(role="assistant", content=str(reply_text))

        if resp_type == "redirect_to_analysis" and isinstance(params, dict):
            action = Action(type="redirect_to_analysis", params=params)
            analysis_responses = parsed.get("analysis_responses")
            return ChatResponse(
                reply=reply,
                action=action,
                bot_messages=bot_messages if bot_messages else [reply_text],
                analysis_responses=analysis_responses,
            )

        return ChatResponse(reply=reply, action=None, bot_messages=bot_messages if bot_messages else [reply_text])

    if isinstance(parsed, dict) and "messages" in parsed:
        msgs = parsed.get("messages", [])
        contents = []
        for item in msgs:
            txt = _extract_text_from_message_item(item)
            if txt:
                contents.append(txt)
        reply_text = contents[-1] if contents else None
        if not reply_text:
            for k in ("reply", "message", "text"):
                v = parsed.get(k)
                if v:
                    reply_text = _extract_text_from_message_item(v)
                    break
        if not reply_text:
            reply_text = str(parsed)
        reply = Message(role="assistant", content=str(reply_text))
        return ChatResponse(reply=reply)

    if isinstance(final, str):
        reply_text = final
    else:
        potential = _extract_text_from_message_item(final)
        reply_text = potential if potential else str(final)

    reply = Message(role="assistant", content=str(reply_text))
    return ChatResponse(reply=reply)
