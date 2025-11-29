# utils/gemini_client.py (fixed for mypy)
import base64
import os
from typing import Any, cast

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
_MODEL = genai.GenerativeModel("gemini-2.0-flash-lite")


def gemini_vision_check(image_base64: str, prompt: str) -> str:
    try:
        image_bytes = base64.b64decode(image_base64)
        resp: Any = _MODEL.generate_content(
            cast(Any, [prompt, {"mime_type": "image/jpeg", "data": image_bytes}])
        )
        txt = (
            getattr(resp, "text", None)
            or (resp and getattr(resp, "get", lambda *_: None)("text"))
            or ""
        )
        return (txt or "").strip()
    except Exception as e:
        print(f"Gemini API error: {e}")
        return ""
