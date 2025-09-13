import base64
import os

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


def gemini_vision_check(image_base64: str, prompt: str) -> str:
    try:
        image_bytes = base64.b64decode(image_base64)

        model = genai.GenerativeModel("gemini-2.0-flash-lite")

        response = model.generate_content(
            [
                prompt,
                {
                    "mime_type": "image/jpeg",  # or "image/png" if needed
                    "data": image_bytes,
                },
            ]
        )

        return response.text.strip()

    except Exception as e:
        print(f"Gemini API error: {e}")
        return "No"
