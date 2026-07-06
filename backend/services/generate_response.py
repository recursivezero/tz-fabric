import os
from typing import Any, Dict

from utils.fallback_analysis import build_fallback_fabric_analysis
from utils.groq_ap_initialize import MODEL, groq_initialize

_client = None
_ANALYSIS_TIMEOUT_SEC = float(os.getenv("GROQ_ANALYSIS_TIMEOUT", "16"))


def _infer_analysis_type(prompt: str) -> str:
    low = (prompt or "").lower()
    if "65" in low or "composition" in low or "surface finish" in low:
        return "long"
    return "short"


def _looks_like_model_error(text: str) -> bool:
    """Return True when the vision model replied with a status/error instead of fabric analysis."""
    low = (text or "").strip().lower()
    if not low:
        return True
    bad_phrases = [
        "unparseable response",
        "uncertain:",
        "analysis did not return",
        "no response",
        "unable to parse",
        "error from model",
        "model error",
    ]
    return any(phrase in low for phrase in bad_phrases)


def _get_client():
    global _client
    if _client is None:
        _client = groq_initialize()
    return _client


def _fallback(image_base64: str, prompt: str, idx: int, reason: str) -> Dict[str, Any]:
    analysis_type = _infer_analysis_type(prompt)
    text = build_fallback_fabric_analysis(image_base64, analysis_type, idx)
    print(f"[Analysis fallback] idx={idx} reason={reason}")
    return {"id": idx, "response": text, "fallback": True, "fallback_reason": reason}


def analyse_fabric_image(image_base64: str, prompt: str, idx: int) -> Dict[str, Any]:
    """
    Analyse a fabric image using Groq's vision model.
    If the remote model is unavailable, slow, or returns an empty answer, return
    a local deterministic fabric analysis instead of making the UI show an error.
    image_base64 must be raw base64 string (no data URL prefix).
    """

    try:
        print(f"[Thread] Prompt: {prompt[:50]}...")

        data_url = f"data:image/jpeg;base64,{image_base64}"
        client = _get_client()

        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    }
                ],
                max_tokens=180,
                timeout=_ANALYSIS_TIMEOUT_SEC,
            )
        except TypeError:
            # Older Groq/OpenAI-compatible clients may not accept per-request
            # timeout. Retry once without breaking local fallback behaviour.
            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    }
                ],
                max_tokens=180,
            )

        if response.choices and response.choices[0].message.content:
            text = response.choices[0].message.content.strip()
            if text and not _looks_like_model_error(text):
                print("[Thread] Response received.")
                return {"id": idx, "response": text}
            if text:
                print(f"[Thread] Ignoring unusable model text: {text[:80]}")
                return _fallback(image_base64, prompt, idx, "unusable_model_response")

        return _fallback(image_base64, prompt, idx, "empty_model_response")

    except Exception as e:
        print("Groq Vision Error:", e)
        return _fallback(image_base64, prompt, idx, str(e) or "vision_error")
