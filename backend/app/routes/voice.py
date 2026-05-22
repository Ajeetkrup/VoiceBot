from fastapi import APIRouter
from app.models.schemas import VoiceRequest, ChatResponse
from app.core.intent_detector import detect_intent
from app.core.llm_chain import run_llm_chain
from app.core.response_builder import build_response
import uuid

router = APIRouter()


@router.post("/voice", response_model=ChatResponse)
async def voice(request: VoiceRequest) -> ChatResponse:
    """
    Handle voice-based interaction.
    The frontend handles STT/TTS via Web Speech API.
    This endpoint receives the transcribed text and returns a structured response.
    """
    session_id = request.session_id or str(uuid.uuid4())
    
    intent = detect_intent(session_id, request.audio_text)
    llm_result = run_llm_chain(session_id, request.audio_text, intent)
    return build_response(session_id, intent, llm_result)
