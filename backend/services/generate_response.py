from backend.utils.gemini_ap_initialize import gemini_initialize

model = gemini_initialize()

def analyse_fabric_image(image_base64: str, prompt: str) -> dict:
    try:
        print(f"🔍 [Thread] Prompt: {prompt[:50]}...")

        response = model.generate_content(
            contents=[{
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": image_base64,
                        }
                    }
                ]
            }]
        )

        if response and hasattr(response, "text"):
            print(f"[Thread] Response received.")
            return {"response": response.text.strip()}
        else:
            print("[Thread] No text in response.")
            return {"response": None}

    except Exception as e:
        print("Error in Gemini thread:", e)
        return {"response": None}