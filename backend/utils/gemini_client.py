import base64
import os

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

_MODEL = genai.GenerativeModel("gemini-2.0-flash-lite")


def gemini_vision_check(image_base64: str, prompt: str) -> str:
    try:
        image_bytes = base64.b64decode(image_base64)

        resp = _MODEL.generate_content([
            prompt,
            { "mime_type": "image/jpeg", "data": image_bytes },
        ])
        return (resp.text or "").strip()

    except Exception as e:
        print(f"Gemini API error: {e}")
        return "No"
