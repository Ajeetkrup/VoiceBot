from fastapi import APIRouter
from app.models.schemas import ChatRequest, ChatResponse
from app.core.intent_detector import detect_intent
from app.core.llm_chain import run_llm_chain
from app.core.response_builder import build_response
import uuid

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """Handle text-based chat interaction."""
    session_id = request.session_id or str(uuid.uuid4())

    intent = detect_intent(session_id, request.message)
    llm_result = run_llm_chain(session_id, request.message, intent)
    return build_response(session_id, intent, llm_result)
