from langchain_groq import ChatGroq
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.runnables.history import RunnableWithMessageHistory
from app.config import GROQ_API_KEY, GROQ_PRIMARY_MODEL
from app.prompts.system_prompt import CHAT_PROMPT
from app.core.memory_store import get_memory

# ─── Fallback responses ───────────────────────────────────────────────────────

DEFAULT_RESPONSE = {
    "response": "I'm here to help with EDAS-related queries. Could you please clarify your request?",
    "suggestions": ["Check my case status", "Raise a complaint", "General enquiry"],
    "escalate": False,
}

ESCALATE_RESPONSE = {
    "response": "I understand. Let me connect you to an EDAS support agent who can assist you further.",
    "suggestions": ["Check my case status", "Raise a complaint", "General enquiry"],
    "escalate": True,
}

# ─── LangChain LCEL chain ─────────────────────────────────────────────────────

llm = ChatGroq(
    model=GROQ_PRIMARY_MODEL,
    temperature=0.4,
    max_tokens=300,
    groq_api_key=GROQ_API_KEY,
)

from langchain_core.runnables import RunnableLambda
import re

def strip_think_tags(text) -> str:
    """Removes <think>...</think> blocks from reasoning models before JSON parsing."""
    content = text.content if hasattr(text, "content") else str(text)
    cleaned = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL)
    return cleaned.strip()

# Chain: ChatPromptTemplate | ChatGroq | strip_think_tags | JsonOutputParser
# JsonOutputParser automatically parses the LLM's JSON string into a Python dict
base_chain = CHAT_PROMPT | llm | RunnableLambda(strip_think_tags) | JsonOutputParser()

# Wraps the chain with automatic memory injection + saving per session_id
# (Removed RunnableWithMessageHistory because it expects a ChatMessageHistory, not BaseMemory)

# ─── Global State ─────────────────────────────────────────────────────────────

# In a real app this would be in a database. For this demo, we maintain a global
# counter that increments whenever a new ticket is issued.
GLOBAL_TICKET_COUNTER = 5678

# ─── Public interface ─────────────────────────────────────────────────────────

def run_llm_chain(session_id: str, user_message: str, intent: str) -> dict:
    """Run the LCEL chain with automatic memory. Returns a parsed response dict."""
    global GLOBAL_TICKET_COUNTER

    print("Intent :", intent) 

    # Short-circuit: unknown intent always escalates without calling the heavy LLM
    if intent == "unknown":
        return ESCALATE_RESPONSE.copy()

    print("Running LLM chain with input:", user_message)  # for debugging

    try:
        print("Current GLOBAL_TICKET_COUNTER:", GLOBAL_TICKET_COUNTER)  # for debugging
        
        # Load memory variables
        memory = get_memory(session_id)
        chat_history = memory.load_memory_variables({})["chat_history"]

        # Pass the global ticket counter and chat history into the prompt template dynamically
        result = base_chain.invoke(
            {
                "input": user_message, 
                "intent": intent, 
                "next_ticket_id": str(GLOBAL_TICKET_COUNTER),
                "chat_history": chat_history,
            }
        )
        
        # Save the interaction to memory
        memory.save_context({"input": user_message}, {"output": str(result.get("response", ""))})

        print("LLM output:", result)  # for debugging

        # 1. Store extracted slots in memory
        memory = get_memory(session_id)
        extracted = result.get("extracted_slots", {})
        if extracted:
            memory.slots.update({k: v for k, v in extracted.items() if v})

        # 2. If the LLM successfully issued our next_ticket_id, increment the global counter
        if extracted.get("ticket_id") == str(GLOBAL_TICKET_COUNTER):
            GLOBAL_TICKET_COUNTER += 1

        print("LLM output:", result)  # for debugging

        # 3. Ensure required keys exist and suggestions has exactly 3 items
        response = {
            "response": str(result.get("response", DEFAULT_RESPONSE["response"])),
            "suggestions": list(result.get("suggestions", DEFAULT_RESPONSE["suggestions"]))[:3],
            "escalate": bool(result.get("escalate", False)),
        }
        while len(response["suggestions"]) < 3:
            response["suggestions"].append("Contact EDAS support")

        return response

    except Exception as e:
        print(f"ERROR in run_llm_chain: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return DEFAULT_RESPONSE.copy()
