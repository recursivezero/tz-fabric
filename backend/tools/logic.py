from typing import Optional, Literal, Dict

def redirect_to_analysis_logic(
    image_url: Optional[str],
    mode: Literal["short", "long"] = "short"
) -> Dict:
    return {
        "type": "redirect_to_analysis",
        "params": {"image_url": image_url, "mode": mode},
        "bot_messages": [
            "I see you want fabric analysis.",
            "Redirecting you to the Fabric Analysis page...",
            "Uploading your image and starting analysis..."
        ],
    }

def chat_reply_logic(text: str) -> Dict:
    return {
        "type": "chat_reply",
        "params": None,
        "bot_messages": [text],
    }
