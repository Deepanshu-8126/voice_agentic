# 🎙️ Kilo AI Voice & Chat Studio Dashboard

All-in-one ChatGPT-style Chat UI + Real-time Low-Latency Gemini Live Voice Agent Dashboard.

---

## ⚡ Quick Start (1-Click Run)

### Windows:
Double click **`run.bat`** (or open PowerShell in this folder and run `.\run.ps1`).

---

## 🛠️ Manual Start (Optional)

### 1. Start Backend:
```bash
uv venv backend\.venv
uv pip install -r backend\requirements.txt --python backend\.venv\Scripts\python.exe
backend\.venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8008
```

### 2. Start Frontend:
```bash
cd frontend
npm run dev
```

Browser me open karein: **`http://localhost:5173`**

---

## 🔑 Setup API Key
1. Dashboard open karke **Settings** (⚙️) icon par click karein.
2. Apna Google Gemini API Key paste karein aur **Test & Save** karein (Free key from [Google AI Studio](https://aistudio.google.com/app/apikey)).
3. Alternatively, `backend/.env` file me `GOOGLE_API_KEY=your_key` add kar sakte hain.

---

## ✨ Features
- **ChatGPT-Style Interface**: Multi-turn chat, markdown rendering, copy code buttons, conversation history & search.
- **Ultra Low-Latency Voice Mode**: Bidirectional real-time voice streaming with Gemini 2.0 Live via WebSockets.
- **Interactive Audio Visualizer**: 3D glowing organic AI orb & waveform reactive to mic input and AI speech.
- **Voice Selection**: Choose between voices (*Aoede, Puck, Charon, Fenrir, Kore*).
- **In-Chat Microphone Dictation**: Instant speech-to-text directly in the chat input bar.
