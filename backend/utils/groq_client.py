# utils/groq_client.py
import base64
import os
from typing import Any, Optional

from groq import Groq
from dotenv import load_dotenv

load_dotenv()

_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
_MODEL = (
    "meta-llama/llama-4-scout-17b-16e-instruct"  # Groq's current vision-capable model
)


def groq_vision_check(image_base64: str, prompt: str) -> str:
    """
    Send an image + prompt to Groq's vision model and return the text output.
    """
    try:
        # Groq expects a data URL, not raw bytes
        data_url = f"data:image/jpeg;base64,{image_base64}"

        resp = _client.chat.completions.create(
            model=_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url},
                        },
                    ],
                }
            ],
            max_tokens=512,
        )

        # Safe extraction
        msg: Optional[Any] = resp.choices[0].message if resp.choices else None
        txt = getattr(msg, "content", "") or ""
        return txt.strip()

    except Exception as e:
        print(f"Groq Vision API error: {e}")
        return ""
