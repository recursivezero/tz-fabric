from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    GOOGLE_API_KEY: str = os.getenv("GEMINI_API_KEY")
    GEMINI_MODEL: str = "gemini-2.0-flash-lite"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
