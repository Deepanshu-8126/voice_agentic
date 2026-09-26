import os
import json
import asyncio
import base64
import logging
from typing import List, Optional, Dict, Any
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Header, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import websockets
import google.generativeai as genai

# Load environment variables
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ai_dashboard")

app = FastAPI(title="Kilo AI Voice & Chat Dashboard API", version="1.0.0")

# Enable CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY", "")

def get_api_key(client_key: Optional[str] = None) -> str:
    key = client_key.strip() if client_key and client_key.strip() else GEMINI_API_KEY
    if not key:
        raise HTTPException(status_code=400, detail="Gemini API Key missing. Please provide it in Settings or .env file.")
    return key

# Models
class Message(BaseModel):
    role: str # "user" or "model" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    model: Optional[str] = "gemini-2.0-flash"
    system_prompt: Optional[str] = "You are a helpful, intelligent, fast, and friendly AI assistant."
    temperature: Optional[float] = 0.7
    apiKey: Optional[str] = None

class KeyVerifyRequest(BaseModel):
    apiKey: Optional[str] = None

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "has_server_key": bool(GEMINI_API_KEY and len(GEMINI_API_KEY) > 5),
        "default_model": os.getenv("DEFAULT_MODEL", "gemini-2.0-flash"),
        "default_voice": os.getenv("DEFAULT_VOICE", "Aoede")
    }

@app.post("/api/verify-key")
async def verify_key(req: KeyVerifyRequest):
    key = get_api_key(req.apiKey)
    try:
        genai.configure(api_key=key)
        # Test key with a fast query
        model = genai.GenerativeModel("gemini-2.0-flash")
        res = model.generate_content("Hi", generation_config={"max_output_tokens": 5})
        return {"valid": True, "message": "API Key is valid and active!"}
    except Exception as e:
        logger.error(f"Key verification error: {e}")
        return JSONResponse(
            status_code=400,
            content={"valid": False, "error": str(e)}
        )

@app.get("/api/models")
async def list_models(key: Optional[str] = None):
    try:
        active_key = get_api_key(key)
        genai.configure(api_key=active_key)
        models = [
            {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash (Fastest & Best Live)", "isDefault": True},
            {"id": "gemini-2.0-flash-lite-preview-02-05", "name": "Gemini 2.0 Flash Lite", "isDefault": False},
            {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "isDefault": False},
            {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro (Deep Reasoning)", "isDefault": False},
        ]
        return {"models": models}
    except Exception:
        # Fallback list
        return {
            "models": [
                {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash (Default)", "isDefault": True},
                {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "isDefault": False},
                {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "isDefault": False},
            ]
        }

@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    active_key = get_api_key(req.apiKey)
    genai.configure(api_key=active_key)

    # Format history for Gemini SDK
    history = []
    for msg in req.messages[:-1]:
        role = "user" if msg.role == "user" else "model"
        history.append({
            "role": role,
            "parts": [msg.content]
        })

    last_user_msg = req.messages[-1].content if req.messages else ""

    async def event_generator():
        try:
            model = genai.GenerativeModel(
                model_name=req.model or "gemini-2.0-flash",
                system_instruction=req.system_prompt
            )
            chat = model.start_chat(history=history)
            response = chat.send_message(
                last_user_msg,
                stream=True,
                generation_config=genai.types.GenerationConfig(
                    temperature=req.temperature or 0.7,
                )
            )

            for chunk in response:
                if chunk.text:
                    payload = json.dumps({"text": chunk.text})
                    yield f"data: {payload}\n\n"
                    await asyncio.sleep(0.005) # smooth stream

            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            logger.error(f"Chat stream error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.post("/api/voice-turn")
async def voice_turn(
    audio: UploadFile = File(...),
    system_prompt: Optional[str] = Form("You are a helpful, natural conversational voice assistant. Keep answers clear and concise for spoken audio."),
    model_name: Optional[str] = Form("gemini-2.0-flash"),
    api_key: Optional[str] = Form(None)
):
    """Fallback high-accuracy Voice turn endpoint for any browser/device"""
    active_key = get_api_key(api_key)
    genai.configure(api_key=active_key)

    try:
        audio_bytes = await audio.read()
        mime_type = audio.content_type or "audio/webm"

        model = genai.GenerativeModel(
            model_name=model_name or "gemini-2.0-flash",
            system_instruction=system_prompt
        )

        response = model.generate_content([
            {"mime_type": mime_type, "data": audio_bytes},
            "Listen to this user speech. Answer naturally, clearly and conversationally. Also provide the user transcript if applicable."
        ])

        return {
            "text": response.text,
            "success": True
        }
    except Exception as e:
        logger.error(f"Voice turn error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Gemini Multimodal Live WebSocket Relay for Realtime Bidirectional Voice
GEMINI_LIVE_WS_HOST = "generativelanguage.googleapis.com"
GEMINI_LIVE_WS_PATH = "/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent"

@app.websocket("/ws/live")
async def websocket_gemini_live(
    websocket: WebSocket,
    apiKey: Optional[str] = None,
    model: Optional[str] = "models/gemini-2.0-flash-exp",
    voice: Optional[str] = "Aoede",
    system_prompt: Optional[str] = "You are an intelligent, low-latency, warm voice assistant. Be concise and natural in conversations."
):
    await websocket.accept()
    
    # Resolve key
    key = apiKey or GEMINI_API_KEY
    if not key:
        await websocket.send_json({"type": "error", "message": "Gemini API key is required."})
        await websocket.close(code=4001)
        return

    gemini_uri = f"wss://{GEMINI_LIVE_WS_HOST}{GEMINI_LIVE_WS_PATH}?key={key}"
    logger.info(f"Connecting to Gemini Live WebSocket API with voice: {voice}...")

    try:
        async with websockets.connect(gemini_uri, subprotocols=["protocol-v1"]) as gemini_ws:
            # 1. Send Setup Configuration to Gemini Live
            model_id = model if model.startswith("models/") else f"models/{model}"
            setup_msg = {
                "setup": {
                    "model": model_id,
                    "generation_config": {
                        "response_modalities": ["AUDIO"],
                        "speech_config": {
                            "voice_config": {
                                "prebuilt_voice_config": {
                                    "voice_name": voice or "Aoede"
                                }
                            }
                        }
                    },
                    "system_instruction": {
                        "parts": [{"text": system_prompt}]
                    }
                }
            }
            await gemini_ws.send(json.dumps(setup_msg))
            logger.info("Sent setup config to Gemini Live")
            await websocket.send_json({"type": "connected", "message": "Connected to Gemini Live Voice Agent"})

            # Tasks for bidirectional pump
            async def client_to_gemini():
                try:
                    while True:
                        msg = await websocket.receive_text()
                        data = json.loads(msg)
                        msg_type = data.get("type")

                        if msg_type == "audio":
                            # Base64 PCM 16kHz audio chunk from mic
                            pcm_base64 = data.get("data")
                            if pcm_base64:
                                payload = {
                                    "realtime_input": {
                                        "media_chunks": [
                                            {
                                                "mime_type": "audio/pcm;rate=16000",
                                                "data": pcm_base64
                                            }
                                        ]
                                    }
                                }
                                await gemini_ws.send(json.dumps(payload))
                        elif msg_type == "text":
                            user_text = data.get("text")
                            payload = {
                                "client_content": {
                                    "turns": [
                                        {
                                            "role": "user",
                                            "parts": [{"text": user_text}]
                                        }
                                    ],
                                    "turn_complete": True
                                }
                            }
                            await gemini_ws.send(json.dumps(payload))
                        elif msg_type == "interrupt":
                            # End/interrupt turn
                            pass
                except WebSocketDisconnect:
                    logger.info("Client disconnected from WebSocket")
                except Exception as e:
                    logger.error(f"client_to_gemini error: {e}")

            async def gemini_to_client():
                try:
                    async for raw_msg in gemini_ws:
                        resp = json.loads(raw_msg)
                        # Check for server content
                        server_content = resp.get("serverContent")
                        if server_content:
                            model_turn = server_content.get("modelTurn")
                            if model_turn:
                                for part in model_turn.get("parts", []):
                                    # Audio part
                                    inline_data = part.get("inlineData")
                                    if inline_data and inline_data.get("mimeType", "").startswith("audio/"):
                                        audio_base64 = inline_data.get("data")
                                        await websocket.send_json({
                                            "type": "audio",
                                            "data": audio_base64,
                                            "mimeType": inline_data.get("mimeType")
                                        })
                                    # Text/transcript part
                                    text = part.get("text")
                                    if text:
                                        await websocket.send_json({
                                            "type": "text",
                                            "text": text
                                        })

                            turn_complete = server_content.get("turnComplete")
                            if turn_complete:
                                await websocket.send_json({"type": "turnComplete"})
                            
                            interrupted = server_content.get("interrupted")
                            if interrupted:
                                await websocket.send_json({"type": "interrupted"})

                except websockets.exceptions.ConnectionClosed:
                    logger.info("Gemini WebSocket closed")
                except Exception as e:
                    logger.error(f"gemini_to_client error: {e}")

            await asyncio.gather(client_to_gemini(), gemini_to_client())

    except Exception as e:
        logger.error(f"WebSocket Gemini Live error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass

if __name__ == "__main__":
    import uvicorn
    PORT = int(os.getenv("PORT", 8008))
    uvicorn.run("main:app", host="127.0.0.1", port=PORT, reload=True)
