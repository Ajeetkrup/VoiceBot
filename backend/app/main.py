from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.routes.chat import router as chat_router
from app.routes.voice import router as voice_router
from app.models.schemas import HealthResponse, SessionInfo
from app.core.memory_store import get_session_info

app = FastAPI(
    title="EDAS VoiceBot API",
    description="Customer support VoiceBot for EDAS — powered by Groq Qwen QwQ-32B",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(voice_router)


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", version="1.0.0")


@app.get("/session/{session_id}", response_model=SessionInfo)
async def get_session(session_id: str):
    info = get_session_info(session_id)
    if not info:
        return JSONResponse(status_code=404, content={"detail": "Session not found"})
    return SessionInfo(**info)
