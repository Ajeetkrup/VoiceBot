from pydantic import BaseModel, Field
from typing import Optional

class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=2000)

class VoiceRequest(BaseModel):
    session_id: Optional[str] = None
    audio_text: str = Field(..., min_length=1, max_length=2000)

class ChatResponse(BaseModel):
    session_id: str
    intent: str
    response: str
    suggestions: list[str]
    escalate: bool

class SessionInfo(BaseModel):
    session_id: str
    turn_count: int
    last_intent: Optional[str]
    history: list[dict]

class HealthResponse(BaseModel):
    status: str
    version: str
