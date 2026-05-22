from dotenv import load_dotenv
import os

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_PRIMARY_MODEL = os.getenv("GROQ_PRIMARY_MODEL", "qwen/qwen3-32b")
GROQ_INTENT_MODEL = os.getenv("GROQ_INTENT_MODEL", "llama-3.1-8b-instant")
MAX_HISTORY_TURNS = int(os.getenv("MAX_HISTORY_TURNS", "10"))
