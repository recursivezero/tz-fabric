from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from datetime import datetime
from services.gemini import chat_once

router = APIRouter(tags=["chat"])

Role = Literal["user", "assistant", "system"]

class Message(BaseModel):
    role: Role
    content: str = Field(min_length=1, max_length=8000)

class ChatRequest(BaseModel):
    messages: List[Message]

class ChatResponse(BaseModel):
    reply: Message

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

    try:
        reply_text = chat_once([m.model_dump() for m in body.messages])
    except Exception:
        raise HTTPException(status_code=502, detail="Model error. Please try again.")

    reply = Message(role="assistant", content=reply_text)
    return ChatResponse(reply=reply)
