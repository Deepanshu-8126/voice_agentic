# 🎙️ Kilo AI Voice & Chat Studio (Gemini Live 2-Way Voice Agent)

An ultra-low latency, real-time multimodal AI Voice Agent and ChatGPT-like Studio built with **FastAPI**, **React + TypeScript (Vite)**, **TailwindCSS**, and official **Google Gemini Live WebSocket API (`google-genai` SDK)**.

---

## 🌟 Key Features

- ⚡ **Real-Time 2-Way Voice Streaming:** Live microphone streaming via 16kHz PCM downsampled audio to Gemini Live WebSockets.
- 🗣️ **Natural Speech Output:** Direct Little-Endian PCM 24kHz audio synthesis played through a dedicated browser `AudioContext` queue.
- 💬 **ChatGPT-Grade Text Chat:** Markdown streaming with syntax-highlighted code blocks, 1-click copy, and model fallback options.
- 🔮 **3D Organic Voice Visualizer:** Reactive 3D Orb and Waveforms that pulsate with live microphone input and AI speaker output.
- 📜 **Live Dialogue Subtitles:** Real-time dual-sided live captions showing what you said and what Gemini is speaking with timestamps.
- 🎚️ **Live VU Meters:** Instant visual decibel indicators for Mic Input and AI Speaker output.

---

## 🏗️ Architecture & Project Structure

```
dk/
├── backend/
│   ├── .env                  # Google Gemini API Keys
│   ├── main.py               # FastAPI server with WebSocket & streaming endpoints
│   └── requirements.txt      # Python dependencies (google-genai, fastapi, uvicorn, websockets)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatArea.tsx        # Main chat conversation interface
│   │   │   ├── MessageItem.tsx     # Markdown & code renderer
│   │   │   ├── Sidebar.tsx         # Conversation history & model selection
│   │   │   ├── VoiceModal.tsx      # Split-screen 3D orb & live captions overlay
│   │   │   ├── VoiceVisualizer.tsx # Canvas-based reactive 3D orb/waveform
│   │   │   └── SettingsModal.tsx   # API key and voice preferences
│   │   ├── services/
│   │   │   ├── audioProcessor.ts   # Resampling (Linear Interpolation) & PCM audio I/O
│   │   │   ├── geminiLiveClient.ts # WebSocket connection client
│   │   │   └── api.ts              # REST and SSE API client
│   │   └── App.tsx
│   └── vite.config.ts
├── run.bat                   # 1-Click Windows launcher
├── run.ps1                   # PowerShell launcher
└── README.md
```

---

## 🚀 Getting Started (Step-by-Step)

### 1. Prerequisites
- **Python 3.10+** (or `uv`)
- **Node.js 18+** & `npm`
- **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/))

### 2. Setup Backend
```bash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

Create a `backend/.env` file:
```env
GOOGLE_API_KEY=your_actual_gemini_api_key_here
PORT=8008
```

### 3. Setup Frontend
```bash
cd frontend
npm install
npm run build
```

### 4. Running the Project
- **Quick Run (Windows):** Double-click `run.bat` or run `.\run.ps1` in PowerShell.
- **Manual Start:**
  ```bash
  # Terminal 1: Backend
  python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8008

  # Terminal 2: Frontend
  cd frontend
  npm run dev
  ```

Open **`http://localhost:5174`** in your browser and click **"Voice Agent"**.

---

## 🧠 Critical Technical Problems Solved & Lessons Learned

If you plan to build or reuse real-time browser voice agents with Gemini in any future project, **always remember these 5 pitfalls and solutions**:

### 1. Microphone Hardware Sample Rate vs. Gemini (The "Garbled/Chipmunk" Bug)
* **Problem:** Laptops capture microphone audio at `44,100 Hz` or `48,000 Hz`. Gemini Live expects strict `16,000 Hz 16-bit PCM`. Sending raw hardware audio makes you sound like a high-pitched fast chipmunk, so AI fails to understand your speech.
* **Solution:** Implement a **Linear Interpolation Downsampler** in JavaScript/TypeScript (`audioProcessor.ts`) to cleanly convert hardware rates to `16,000 Hz Int16 PCM` before base64 encoding.

### 2. AudioContext Conflicts & Browser Autoplay Policies
* **Problem:** Browsers block audio playback unless initiated by an explicit user gesture (e.g., clicking a button). Sharing one `AudioContext` for recording and playback causes sample rate conflicts and mute states.
* **Solution:**
  - Create **two distinct contexts**: one for Mic Capture (hardware rate) and one for Playback (`24,000 Hz`).
  - Always trigger `audioContext.resume()` immediately upon the user clicking the "Voice Agent" button.

### 3. Little-Endian PCM Byte Order Decoding
* **Problem:** Incoming Gemini audio chunks arrive as base64 raw binary bytes in Little-Endian 16-bit signed integer format. Casting directly to `Int16Array(bytes.buffer)` produces offset errors or silent audio.
* **Solution:** Use JavaScript `DataView.getInt16(i * 2, true)` to accurately extract PCM samples and normalize them into `Float32Array` for the browser's `AudioBufferSourceNode`.

### 4. Voice Activity Detection (VAD) & End-of-Speech Detection
* **Problem:** Gemini Live needs to know when the user has finished speaking to start generating the response.
* **Solution:** Configure `RealtimeInputConfig` in the setup handshake:
  ```python
  realtime_input_config=types.RealtimeInputConfig(
      automatic_activity_detection=types.AutomaticActivityDetection(
          start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
          end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_LOW,
          prefix_padding_ms=100,
          silence_duration_ms=500,
      )
  )
  ```

### 5. Gemini 503 / Model Availability Failover
* **Problem:** Gemini experimental models frequently deprecate or experience temporary 503 high-demand spikes.
* **Solution:**
  - For **Text/Chat Stream**: Use `gemini-3.7-flash` with automatic fallback to `gemini-3.5-flash` and `gemini-3.1-flash-lite`.
  - For **Live Voice Bidi WS**: Use `models/gemini-3.1-flash-live-preview`.

---

## 🔒 Security Note
Never commit `.env` or hardcode your `GOOGLE_API_KEY` into Git repositories. Use environment variables and `.gitignore`.
