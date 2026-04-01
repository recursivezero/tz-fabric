import os
from pathlib import Path
from dotenv import load_dotenv


def init_env():
    # APP_ENV is ONLY used to pick the file — never stored in the app
    # Falls back to 'development' if not set
    app_env = os.getenv("APP_ENV", "development")

    file_map = {
        "production": ".env.production",
        "development": ".env.development",
    }

    env_file = file_map.get(app_env, ".env.development")
    env_path = Path(env_file)

    if not env_path.exists():
        raise FileNotFoundError(f"Missing env file: {env_file}")

    # override=True so the file wins over any stale shell exports
    load_dotenv(env_path, override=True)

    print(f"DEBUG: Loaded {env_file} → ENVIRONMENT={os.getenv('ENVIRONMENT')}")
