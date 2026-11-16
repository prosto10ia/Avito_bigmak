import os


class Config:
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///ai_buddy.db")
    DEMO_ACCESS_CODE = os.getenv("DEMO_ACCESS_CODE", "hack-and-change-2026")
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
    OLLAMA_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "180"))
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
