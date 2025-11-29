from .prompt_config import PROMPT_CONFIG


def generate_prompts(analysis_type: str) -> list:
    config = PROMPT_CONFIG[analysis_type]

    base = (
        f"You are a textile expert. Analyze this fabric image and describe "
        f"{config['length_instruction']}: {config['details']}. "
        f"Be concise and precise. Use precise textile terms."
    )

    return [
        f"{base}\nNote: This is variation {i + 1}. Provide a slightly different perspective."
        for i in range(6)
    ]
