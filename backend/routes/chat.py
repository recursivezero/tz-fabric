# rotes/chat.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Dict, Any
from agent.graph import agent_graph, SYSTEM_PROMPT
import json

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

    parsed = final
    if isinstance(final, str):
        try:
            parsed = json.loads(final)
        except Exception:
            parsed = None

    if isinstance(parsed, dict) and "type" in parsed and "bot_messages" in parsed:
        resp_type = parsed.get("type")
        bot_messages = parsed.get("bot_messages", [])
        params = parsed.get("params")
        reply_text = bot_messages[0] if bot_messages else "OK."
        reply = Message(role="assistant", content=reply_text)

        if resp_type == "redirect_to_analysis" and isinstance(params, dict):
            action = Action(type="redirect_to_analysis", params=params)
            # Pass analysis_responses through (or None)
            analysis_responses = parsed.get("analysis_responses")
            return ChatResponse(
                reply=reply,
                action=action,
                bot_messages=bot_messages,
                analysis_responses=analysis_responses,
            )

        return ChatResponse(reply=reply, action=None, bot_messages=bot_messages)

    reply_text = final if isinstance(final, str) else str(final)
    reply = Message(role="assistant", content=reply_text)
    return ChatResponse(reply=reply)
