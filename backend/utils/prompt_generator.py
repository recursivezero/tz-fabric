def generate_prompts(analysis_type: str) -> list:
    base = (
        "You are a textile expert. Analyze this fabric image and describe in exactly 15–20 words: Material, Color, Pattern, and Texture. Be concise and precise."
        if analysis_type == "short"
        else
        "You are a textile expert. Analyze this fabric image and describe in no more than 65 words: Material & Composition, Color Details, Pattern Type, Background Texture, Surface Finish. Use precise textile terms."
    )
    return [
        f"{base}\nNote: This is variation {i+1}. Provide a slightly different perspective."
        for i in range(6)
    ]