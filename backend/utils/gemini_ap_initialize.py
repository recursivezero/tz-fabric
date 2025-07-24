import google.generativeai as genai
from docs.utils.constants import gemini_key

def gemini_initialize():
    genai.configure(api_key=gemini_key)
    model = genai.GenerativeModel("gemini-2.0-flash-lite")
    if model is None:
        return exit(1)
    return model

