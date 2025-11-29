from typing import Any, Dict, List, cast
import os

import google.generativeai as genai

from core.config import settings

api_key = getattr(settings, "GOOGLE_API_KEY", os.getenv("GEMINI_API_KEY"))
model_name = getattr(
    settings, "GEMINI_MODEL", os.getenv("GEMINI_MODEL", "gemini-2.0-flash-lite")
)

genai.configure(api_key=api_key)

SYSTEM_PROMPT = (
    "You are a helpful assistant ONLY for fabric/textiles and this app.\n"
    "- Allowed: fabrics, textiles, yarn, weave/knit, GSM, fiber types, dyeing/finishing, fabric quality, care, testing, and questions about using this app.\n"
    "- If the user asks for anything outside those topics (e.g., politics, celebrities, math/coding problems, finance, medical, legal, general trivia), you MUST refuse briefly and suggest a related fabric/app topic instead.\n"
    "Always answer in simple, clear language."
)

model = genai.GenerativeModel(
    model_name=model_name,
    system_instruction=SYSTEM_PROMPT,
)


def to_gemini_history(messages: List[Dict]) -> List[Dict]:
    history: List[Dict] = []
    for m in messages:
        role = str(m.get("role", "")).lower()
        content = str(m.get("content", "")).strip()
        if not content:
            continue
        if role == "system":
            continue
        gem_role = "model" if role == "assistant" else "user"
        history.append({"role": gem_role, "parts": [{"text": content}]})
    return history


def chat_once(messages: List[Dict]) -> str:
    contents = to_gemini_history(messages)
    resp: Any = model.generate_content(cast(Any, contents))
    return (getattr(resp, "text", "") or "").strip()
