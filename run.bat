@echo off
title Kilo AI Voice & Chat Dashboard
echo ========================================================
echo   Launching Kilo AI Voice and Chat Studio Dashboard
echo ========================================================

:: Check if Python venv exists
if not exist "backend\.venv\Scripts\python.exe" (
    echo [*] Setting up Python virtual environment...
    uv venv backend\.venv
    uv pip install -r backend\requirements.txt --python backend\.venv\Scripts\python.exe
)

:: Start Backend in background
echo [*] Starting FastAPI Backend on http://127.0.0.1:8008 ...
start /B "" "backend\.venv\Scripts\python.exe" -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8008

:: Start Frontend
echo [*] Starting Vite Frontend on http://localhost:5173 ...
cd frontend
npm run dev

pause
