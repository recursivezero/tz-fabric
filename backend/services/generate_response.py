from typing import Any, Dict
from utils.groq_ap_initialize import groq_initialize, MODEL

client = groq_initialize()


def analyse_fabric_image(image_base64: str, prompt: str, idx: int) -> Dict[str, Any]:
    """
    Analyse a fabric image using Groq's vision model.
    image_base64 must be raw base64 string (no data URL prefix).
    """

    try:
        print(f"[Thread] Prompt: {prompt[:50]}...")

        # Groq requires image as data URL
        data_url = f"data:image/png;base64,{image_base64}"

        response = client.chat.completions.create(
            model=MODEL,
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

        # extract text in a safe, predictable way
        if response.choices and response.choices[0].message.content:
            text = response.choices[0].message.content.strip()
            print("[Thread] Response received.")
            return {"id": idx, "response": text}

        print("[Thread] No text in response.")
        return {"id": idx, "response": None}

    except Exception as e:
        print("Groq Vision Error:", e)
        return {"id": idx, "response": None}
