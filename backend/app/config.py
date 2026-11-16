import os


class Config:
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///ai_buddy.db")
    DEMO_ACCESS_CODE = os.getenv("DEMO_ACCESS_CODE", "hack-and-change-2026")
    LLM_API_KEY = os.getenv("LLM_API_KEY", "")
