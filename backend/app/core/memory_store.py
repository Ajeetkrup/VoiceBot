from langchain_classic.memory import ConversationBufferWindowMemory
from app.config import MAX_HISTORY_TURNS

from pydantic import Field

class SessionMemory(ConversationBufferWindowMemory):
    slots: dict = Field(default_factory=dict)

# Maps session_id → a LangChain SessionMemory instance
_memory_store: dict[str, SessionMemory] = {}


def get_memory(session_id: str) -> SessionMemory:
    """Get or create a LangChain memory object for a given session, with slot tracking."""
    if session_id not in _memory_store:
        memory = SessionMemory(
            k=MAX_HISTORY_TURNS,    # automatically keeps only last N turns
            memory_key="chat_history",
            return_messages=True,   # returns HumanMessage/AIMessage objects
        )
        _memory_store[session_id] = memory
        
    return _memory_store[session_id]


def get_session_info(session_id: str) -> dict | None:
    """Return serialisable session info for the GET /session/{id} endpoint."""
    memory = _memory_store.get(session_id)
    if not memory:
        return None
    messages = memory.chat_memory.messages
    history = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": m.content}
        for i, m in enumerate(messages)
    ]
    return {
        "session_id": session_id,
        "turn_count": len(messages) // 2,
        "last_intent": None,   # intent tracking removed; extend here if needed
        "history": history,
        "slots": getattr(memory, "slots", {}),
    }
