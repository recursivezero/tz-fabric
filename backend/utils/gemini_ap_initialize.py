import os

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()


def gemini_initialize():
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel("gemini-2.0-flash-lite")
    if model is None:
        return exit(1)
    return model
