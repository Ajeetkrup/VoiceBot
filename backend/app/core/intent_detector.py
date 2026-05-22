from langchain_groq import ChatGroq
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables.history import RunnableWithMessageHistory
from app.config import GROQ_API_KEY, GROQ_INTENT_MODEL
from app.prompts.system_prompt import INTENT_PROMPT
from app.core.memory_store import get_memory

VALID_INTENTS = {"check_status", "raise_complaint", "general_query", "unknown"}

# LCEL pipeline: prompt → LLM → parse to plain string
base_intent_chain = INTENT_PROMPT | ChatGroq(
    model=GROQ_INTENT_MODEL,
    temperature=0.0,
    max_tokens=10,
    groq_api_key=GROQ_API_KEY,
) | StrOutputParser()

intent_chain_with_memory = RunnableWithMessageHistory(
    base_intent_chain,
    get_memory,
    input_messages_key="input",
    history_messages_key="chat_history",
)

def detect_intent(session_id: str, message: str) -> str:
    """Classify intent via Groq LLaMA Instant using a context-aware LangChain LCEL chain."""
    try:
        raw = intent_chain_with_memory.invoke(
            {"input": message},
            config={"configurable": {"session_id": session_id}}
        ).strip().lower()
        intent = raw.split()[0] if raw else "general_query"
        return intent if intent in VALID_INTENTS else "general_query"
    except Exception:
        return "general_query"


