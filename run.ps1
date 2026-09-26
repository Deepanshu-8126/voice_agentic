Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Launching Kilo AI Voice & Chat Studio Dashboard      " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan

# Start Backend
$backendProcess = Start-Process -FilePath "backend\.venv\Scripts\python.exe" -ArgumentList "-m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8008" -PassThru -NoNewWindow

# Start Frontend
Set-Location -Path "frontend"
npm run dev
