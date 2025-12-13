# utils/groq_initialize.py

import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


def groq_initialize() -> Groq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY environment variable not set")

    client = Groq(api_key=api_key)
    return client
