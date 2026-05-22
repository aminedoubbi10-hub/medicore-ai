$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot

Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$Root\scripts\start-backend.ps1`"" -WindowStyle Normal
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$Root\scripts\start-frontend.ps1`"" -WindowStyle Normal

Write-Host "MediCore AI local dev starting:"
Write-Host "Backend:  http://127.0.0.1:8000/health"
Write-Host "API docs: http://127.0.0.1:8000/api/docs"
Write-Host "Frontend: http://localhost:3000"
