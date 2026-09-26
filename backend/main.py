import os
import json
import asyncio
import base64
import logging
from typing import List, Optional, Dict, Any
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import websockets
from google import genai
from google.genai import types

# Load environment variables
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ai_dashboard")

app = FastAPI(title="Kilo AI Voice & Chat Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY", "")

def get_api_key(client_key: Optional[str] = None) -> str:
    key = client_key.strip() if client_key and client_key.strip() else os.getenv("GOOGLE_API_KEY", "")
    if not key:
        raise HTTPException(status_code=400, detail="Gemini API Key missing. Please provide it in Settings or .env file.")
    return key

class Message(BaseModel):
    role: str # "user" or "model" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    model: Optional[str] = "gemini-3.8-flash"
    system_prompt: Optional[str] = "You are a helpful, intelligent, fast, and friendly AI assistant."
    temperature: Optional[float] = 0.7
    apiKey: Optional[str] = None

class KeyVerifyRequest(BaseModel):
    apiKey: Optional[str] = None

@app.get("/api/health")
async def health_check():
    key = os.getenv("GOOGLE_API_KEY", "")
    return {
        "status": "ok",
        "has_server_key": bool(key and len(key) > 5),
        "default_model": os.getenv("DEFAULT_MODEL", "gemini-3.8-flash"),
        "default_voice": os.getenv("DEFAULT_VOICE", "Aoede")
    }

@app.post("/api/verify-key")
async def verify_key(req: KeyVerifyRequest):
    key = get_api_key(req.apiKey)
    try:
        client = genai.Client(api_key=key)
        res = client.models.generate_content(
            model="gemini-3.8-flash",
            contents="Hi"
        )
        return {"valid": True, "message": "API Key is valid and active!"}
    except Exception as e:
        logger.error(f"Key verification error: {e}")
        return JSONResponse(
            status_code=400,
            content={"valid": False, "error": str(e)}
        )

@app.get("/api/models")
async def list_models(key: Optional[str] = None):
    return {
        "models": [
            {"id": "gemini-3.8-flash", "name": "Gemini 3.8 Flash (Fastest & Best Live)", "isDefault": True},
            {"id": "gemini-3.7-flash", "name": "Gemini 3.7 Flash", "isDefault": False},
            {"id": "gemini-3.5-flash", "name": "Gemini 3.5 Flash", "isDefault": False},
            {"id": "gemini-flash-latest", "name": "Gemini Flash Latest", "isDefault": False},
            {"id": "gemini-3.1-pro-preview", "name": "Gemini 3.1 Pro (Deep Reasoning)", "isDefault": False},
        ]
    }

@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    active_key = get_api_key(req.apiKey)
    client = genai.Client(api_key=active_key)

    # Format history
    contents = []
    for msg in req.messages:
        role = "user" if msg.role == "user" else "model"
        contents.append(types.Content(
            role=role,
            parts=[types.Part.from_text(text=msg.content)]
        ))

    model_name = req.model or "gemini-3.8-flash"

    async def event_generator():
        try:
            config = types.GenerateContentConfig(
                temperature=req.temperature or 0.7,
                system_instruction=req.system_prompt
            )
            response = client.models.generate_content_stream(
                model=model_name,
                contents=contents,
                config=config
            )

            for chunk in response:
                if chunk.text:
                    payload = json.dumps({"text": chunk.text})
                    yield f"data: {payload}\n\n"
                    await asyncio.sleep(0.005)

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
    model_name: Optional[str] = Form("gemini-3.8-flash"),
    api_key: Optional[str] = Form(None)
):
    active_key = get_api_key(api_key)
    client = genai.Client(api_key=active_key)

    try:
        audio_bytes = await audio.read()
        mime_type = audio.content_type or "audio/webm"

        part = types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)
        response = client.models.generate_content(
            model=model_name or "gemini-3.8-flash",
            contents=[
                part,
                "Listen to this user speech. Answer naturally, clearly and conversationally."
            ],
            config=types.GenerateContentConfig(
                system_instruction=system_prompt
            )
        )

        return {
            "text": response.text,
            "success": True
        }
    except Exception as e:
        logger.error(f"Voice turn error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
    
    key = apiKey or os.getenv("GOOGLE_API_KEY", "")
    if not key:
        await websocket.send_json({"type": "error", "message": "Gemini API key is required."})
        await websocket.close(code=4001)
        return

    gemini_uri = f"wss://{GEMINI_LIVE_WS_HOST}{GEMINI_LIVE_WS_PATH}?key={key}"
    logger.info(f"Connecting to Gemini Live WebSocket API with voice: {voice}...")

    try:
        async with websockets.connect(gemini_uri, subprotocols=["protocol-v1"]) as gemini_ws:
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

            async def client_to_gemini():
                try:
                    while True:
                        msg = await websocket.receive_text()
                        data = json.loads(msg)
                        msg_type = data.get("type")

                        if msg_type == "audio":
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
                except WebSocketDisconnect:
                    pass
                except Exception as e:
                    logger.error(f"client_to_gemini error: {e}")

            async def gemini_to_client():
                try:
                    async for raw_msg in gemini_ws:
                        resp = json.loads(raw_msg)
                        server_content = resp.get("serverContent")
                        if server_content:
                            model_turn = server_content.get("modelTurn")
                            if model_turn:
                                for part in model_turn.get("parts", []):
                                    inline_data = part.get("inlineData")
                                    if inline_data and inline_data.get("mimeType", "").startswith("audio/"):
                                        audio_base64 = inline_data.get("data")
                                        await websocket.send_json({
                                            "type": "audio",
                                            "data": audio_base64,
                                            "mimeType": inline_data.get("mimeType")
                                        })
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
                    pass
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
