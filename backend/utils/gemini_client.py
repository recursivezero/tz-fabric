import google.generativeai as genai
import base64

from docs.utils.constants import gemini_key

genai.configure(api_key=gemini_key)

def gemini_vision_check(image_base64: str, prompt: str) -> str:
    try:
        # Decode base64 to bytes
        image_bytes = base64.b64decode(image_base64)

        # Use Gemini Vision model
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
        print(f"❌ Gemini API error: {e}")
        return "No"
