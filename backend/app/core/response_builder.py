from app.models.schemas import ChatResponse


def build_response(session_id: str, intent: str, llm_result: dict) -> ChatResponse:
    """Combine LLM result into a structured ChatResponse."""
    return ChatResponse(
        session_id=session_id,
        intent=intent,
        response=llm_result["response"],
        suggestions=llm_result["suggestions"],
        escalate=llm_result["escalate"],
    )
