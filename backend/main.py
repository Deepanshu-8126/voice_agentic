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

def get_api_key(client_key: Optional[str] = None) -> str:
    key = client_key.strip() if client_key and client_key.strip() else os.getenv("GOOGLE_API_KEY", "")
    if not key:
        raise HTTPException(status_code=400, detail="Gemini API Key missing. Please provide it in Settings or .env file.")
    return key

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    model: Optional[str] = "gemini-3.7-flash"
    system_prompt: Optional[str] = "You are a helpful, intelligent, fast, and friendly AI assistant."
    temperature: Optional[float] = 0.7
    apiKey: Optional[str] = None

class KeyVerifyRequest(BaseModel):
    apiKey: Optional[str] = None

@app.get("/api/health")
async def health_check():
    key = os.getenv("GOOGLE_API_KEY", "")
    return {
        "status": "healthy",
        "has_server_key": bool(key and len(key) > 5),
        "default_model": "gemini-3.7-flash",
        "default_voice": "Aoede"
    }

@app.post("/api/verify-key")
async def verify_key(req: KeyVerifyRequest):
    test_key = req.apiKey.strip() if req.apiKey and req.apiKey.strip() else os.getenv("GOOGLE_API_KEY", "")
    if not test_key:
        return JSONResponse(status_code=400, content={"valid": False, "error": "No API key provided."})

    try:
        client = genai.Client(api_key=test_key)
        resp = client.models.generate_content(
            model="gemini-3.7-flash",
            contents="Say 'OK' in 1 word."
        )
        if resp and resp.text:
            return {"valid": True, "model": "gemini-3.7-flash"}
        return JSONResponse(status_code=400, content={"valid": False, "error": "Empty response from Gemini."})
    except Exception as e:
        return JSONResponse(status_code=400, content={"valid": False, "error": str(e)})

@app.get("/api/models")
async def get_models():
    return {
        "models": [
            {"id": "gemini-3.7-flash", "name": "Gemini 3.7 Flash (Fast & Stable)", "isDefault": True},
            {"id": "gemini-3.5-flash", "name": "Gemini 3.5 Flash", "isDefault": False},
            {"id": "gemini-3.1-flash-lite", "name": "Gemini 3.1 Flash Lite (Ultra Low Latency)", "isDefault": False},
            {"id": "gemini-3.8-flash", "name": "Gemini 3.8 Flash", "isDefault": False},
            {"id": "gemini-3.1-pro-preview", "name": "Gemini 3.1 Pro (Deep Reasoning)", "isDefault": False},
        ]
    }

@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    active_key = get_api_key(req.apiKey)
    client = genai.Client(api_key=active_key)

    contents = []
    for msg in req.messages:
        role = "user" if msg.role == "user" else "model"
        contents.append(types.Content(
            role=role,
            parts=[types.Part.from_text(text=msg.content)]
        ))

    model_name = req.model or "gemini-3.7-flash"
    fallback_models = ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.8-flash"]
    if model_name not in fallback_models:
        fallback_models.insert(0, model_name)

    async def event_generator():
        success = False
        last_err = None
        for current_model in fallback_models:
            try:
                config = types.GenerateContentConfig(
                    temperature=req.temperature or 0.7,
                    system_instruction=req.system_prompt
                )
                response = client.models.generate_content_stream(
                    model=current_model,
                    contents=contents,
                    config=config
                )

                for chunk in response:
                    if chunk.text:
                        payload = json.dumps({"text": chunk.text})
                        yield f"data: {payload}\n\n"
                        await asyncio.sleep(0.005)

                yield f"data: {json.dumps({'done': True})}\n\n"
                success = True
                break
            except Exception as e:
                err_str = str(e)
                logger.warning(f"Model {current_model} failed with error: {err_str}. Trying fallback...")
                last_err = err_str
                if "503" in err_str or "UNAVAILABLE" in err_str or "429" in err_str or "high demand" in err_str:
                    continue
                else:
                    break

        if not success:
            logger.error(f"All models failed. Last error: {last_err}")
            yield f"data: {json.dumps({'error': last_err or 'Service unavailable. Please retry.'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.websocket("/ws/live")
async def websocket_gemini_live(
    websocket: WebSocket,
    apiKey: Optional[str] = None,
    model: Optional[str] = "models/gemini-3.1-flash-live-preview",
    voice: Optional[str] = "Aoede",
    system_prompt: Optional[str] = "You are an intelligent, low-latency, warm conversational voice assistant. Keep answers natural and concise."
):
    await websocket.accept()
    
    key = apiKey or os.getenv("GOOGLE_API_KEY", "")
    if not key:
        await websocket.send_json({"type": "error", "message": "Gemini API key is required."})
        await websocket.close(code=4001)
        return

    live_model = "gemini-3.1-flash-live-preview"
    logger.info(f"Connecting to official google-genai Live session with model={live_model}, voice={voice}...")

    live_config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        system_instruction=types.Content(parts=[types.Part.from_text(text=system_prompt or "You are a warm, direct voice assistant.")]),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice or "Aoede")
            )
        ),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
                end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_LOW,
                prefix_padding_ms=100,
                silence_duration_ms=500,
            )
        ),
    )

    client = genai.Client(api_key=key)

    try:
        async with client.aio.live.connect(model=live_model, config=live_config) as session:
            logger.info("Official Gemini Live session established!")
            await websocket.send_json({"type": "connected", "message": "Connected to Gemini Live"})

            async def pump_browser_to_gemini():
                try:
                    while True:
                        msg = await websocket.receive_text()
                        data = json.loads(msg)
                        msg_type = data.get("type")

                        if msg_type == "audio":
                            pcm_b64 = data.get("data")
                            if pcm_b64:
                                raw_bytes = base64.b64decode(pcm_b64)
                                await session.send_realtime_input(
                                    audio=types.Blob(
                                        data=raw_bytes,
                                        mime_type="audio/pcm;rate=16000"
                                    )
                                )
                        elif msg_type == "text":
                            user_text = data.get("text")
                            if user_text:
                                await session.send(input=user_text, end_of_turn=True)
                except WebSocketDisconnect:
                    pass
                except Exception as e:
                    logger.error(f"pump_browser_to_gemini error: {e}")

            async def pump_gemini_to_browser():
                try:
                    while True:
                        async for raw_message in session.receive():
                            server_content = getattr(raw_message, "server_content", None)
                            if server_content is not None:
                                # 1. Audio chunks
                                model_turn = getattr(server_content, "model_turn", None)
                                parts = getattr(model_turn, "parts", None) if model_turn is not None else None
                                for part in (parts or []):
                                    inline_data = getattr(part, "inline_data", None)
                                    audio_bytes = getattr(inline_data, "data", None) if inline_data is not None else None
                                    if audio_bytes and isinstance(audio_bytes, bytes):
                                        b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
                                        await websocket.send_json({
                                            "type": "audio",
                                            "data": b64_audio
                                        })

                                # 2. User & Agent transcription
                                in_tx = getattr(server_content, "input_transcription", None)
                                if in_tx and getattr(in_tx, "text", None):
                                    await websocket.send_json({
                                        "type": "userText",
                                        "text": in_tx.text
                                    })

                                out_tx = getattr(server_content, "output_transcription", None)
                                if out_tx and getattr(out_tx, "text", None):
                                    await websocket.send_json({
                                        "type": "text",
                                        "text": out_tx.text
                                    })

                                # 3. Status events
                                if getattr(server_content, "turn_complete", False):
                                    await websocket.send_json({"type": "turnComplete"})
                                
                                if getattr(server_content, "interrupted", False):
                                    await websocket.send_json({"type": "interrupted"})

                except Exception as e:
                    logger.error(f"pump_gemini_to_browser error: {e}")

            await asyncio.gather(pump_browser_to_gemini(), pump_gemini_to_browser())

    except Exception as e:
        logger.error(f"Gemini Live session error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass

if __name__ == "__main__":
    import uvicorn
    PORT = int(os.getenv("PORT", 8008))
    uvicorn.run("main:app", host="127.0.0.1", port=PORT, reload=True)
