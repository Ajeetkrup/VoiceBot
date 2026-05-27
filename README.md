# EDAS VoiceBot — Customer Support System

A voice-enabled AI customer support assistant for EDAS, powered by **Groq** and **FastAPI**. The bot (named **Aria**) handles status enquiries, complaint escalations, and general queries about EDAS services — with strict guardrails against hallucination.

---

## Overview

EDAS VoiceBot provides a dual-mode interface:
- **Text Chat** — via the `/chat` REST endpoint
- **Voice** — the browser handles Speech-to-Text (STT) and Text-to-Speech (TTS) using the Web Speech API; transcribed text is sent to the `/voice` endpoint

The backend uses a two-stage AI pipeline:
1. **Intent Classifier** (`llama-3.1-8b-instant`) — fast keyword rules with LLM fallback
2. **Response Generator** (`qwen3-32b`) — generates structured JSON responses with empathy guardrails

---

## Tech Stack

| Layer             | Technology                       |
|-------------------|----------------------------------|
| API Framework     | FastAPI 0.115.5                  |
| ASGI Server       | Uvicorn (with standard extras)   |
| LLM Provider      | Groq Cloud API                   |
| Primary LLM       | `qwen3-32b`                   |
| Intent LLM        | `llama-3.1-8b-instant`           |
| Schema Validation | Pydantic v2                      |
| Config Management | python-dotenv                    |
| HTTP Client       | httpx 0.27.2                     |
| Python Version    | 3.11+                            |

---

## Project Structure

```
Voice Bot/
├── backend/
│   ├── __init__.py
│   ├── main.py                   # FastAPI app entry point
│   ├── config.py                 # Environment config loader
│   ├── requirements.txt
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py            # Pydantic v2 request/response models
│   ├── prompts/
│   │   ├── __init__.py
│   │   └── system_prompt.py      # Aria system prompt + intent classifier prompt
│   ├── core/
│   │   ├── __init__.py
│   │   ├── intent_detector.py    # Keyword rules + LLM fallback intent detection
│   │   ├── context_manager.py    # In-memory session store with expiry
│   │   ├── llm_chain.py          # Groq Qwen-32B LLM orchestration
│   │   └── response_builder.py   # Assembles final ChatResponse
│   └── routes/
│       ├── __init__.py
│       ├── chat.py               # POST /chat
│       └── voice.py              # POST /voice
├── .env.example
└── README.md
```

---

## Setup & Installation

### 1. Clone / enter the project

```bash
cd "Voice Bot"
```

## API Endpoints

- `GET /health` — Check server health.
- `GET /session/{session_id}` — Retrieve chat history for a session.
- `POST /chat` — Send a text message to the bot.
- `POST /voice` — Send transcribed voice text to the bot.

---

## Example Usage

**Text Chat:**
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the status of my case?"}'
```

**Response:**
```json
{
  "session_id": "auto-generated-uuid",
  "intent": "check_status",
  "response": "I'd be happy to help you check your case status. Could you please provide your case ID or the registered email address associated with your request?",
  "suggestions": [
    "I have my case ID ready",
    "I don't have my case ID",
    "Check via registered email"
  ],
  "escalate": false
}
```

---

### `POST /voice`

Handle voice input (STT-transcribed text from the browser).

**Request Body:**
```json
{
  "session_id": "optional-uuid-string",
  "audio_text": "I want to raise a complaint about my delayed request"
}
```

**Response:** Same shape as `/chat`.

---

### `GET /session/{session_id}`

Inspect an active session's history.

**Response:**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "turn_count": 3,
  "last_intent": "check_status",
  "history": [
    {"role": "user", "content": "What is the status of my case?"},
    {"role": "assistant", "content": "I'd be happy to help..."}
  ]
}
```

Returns `404` if the session is not found or has expired (30 min timeout).

---

## Example cURL Commands

### Text chat

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the status of my case?"
  }'
```

### Voice (transcribed text)

```bash
curl -X POST http://localhost:8000/voice \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "my-session-123",
    "audio_text": "I want to raise a complaint about my delayed request"
  }'
```

### Continue a session

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "my-session-123",
    "message": "It has been 3 weeks and nothing happened"
  }'
```

---

## How Voice Works

The EDAS VoiceBot uses the browser's native **Web Speech API** for all STT/TTS processing — no audio files are sent to the backend.

**Flow:**

```
User speaks
    ↓
Browser STT (SpeechRecognition API)
    ↓
Transcribed text → POST /voice
    ↓
Backend: intent detection + LLM response
    ↓
JSON response.response text → Browser TTS (SpeechSynthesis API)
    ↓
Aria speaks back to the user
```

**Why this approach?**
- Zero audio upload latency
- No audio storage/processing costs
- Privacy-friendly — audio stays on the device
- Works in all modern browsers (Chrome, Edge, Safari)

---

## Intent Detection Logic

The system uses a **two-stage cascade**:

1. **Keyword Rules** (fast, zero-cost): Regex patterns match common phrases for `check_status` and `raise_complaint`.
2. **LLM Fallback** (Groq `llama-3.1-8b-instant`): For messages not caught by keywords, the fast 8B model classifies into one of:
   - `check_status`
   - `raise_complaint`
   - `general_query`
   - `unknown` (triggers human escalation)

---

## Session Management

- Sessions are stored **in-memory** — they are reset on server restart.
- Sessions auto-expire after **30 minutes** of inactivity.
- History is capped at the last **10 conversation turns** (configurable via `MAX_HISTORY_TURNS`).
- Each session tracks: `session_id`, `turn_count`, `last_intent`, full `messages` history, and extracted `slots`.
- Memory is managed via a custom `SessionMemory` Pydantic subclass that extends LangChain's `ConversationBufferWindowMemory` to allow robust native slot tracking.
- History injection uses explicit LCEL memory loading and context saving, bypassing compatibility issues with `RunnableWithMessageHistory`.

---

## Response Generation & Guardrails

The system employs strict prompt engineering and custom logic to maintain strong boundaries:
1. **Strict Complaint Workflow:** The bot must first collect the details of the issue from the user *before* registering a new complaint and issuing a ticket ID.
2. **Reasoning Models Support:** Because `qwen3-32b` is a reasoning model, a custom `RunnableLambda` step intercepts its raw output, mathematically stripping away the internal `<think>...</think>` monologues before passing the sanitized text to the strict JSON parser.

---

## Environment Variables

| Variable              | Default                | Description                        |
|-----------------------|------------------------|------------------------------------|
| `GROQ_API_KEY`        | *(required)*           | Your Groq Cloud API key            |
| `GROQ_PRIMARY_MODEL`  | `qwen3-32b`         | Main response generation model     |
| `GROQ_INTENT_MODEL`   | `llama-3.1-8b-instant` | Fast intent classification model   |
| `MAX_HISTORY_TURNS`   | `10`                   | Max conversation turns kept in RAM |
