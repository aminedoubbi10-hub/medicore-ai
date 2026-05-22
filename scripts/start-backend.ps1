$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Python = Join-Path $Backend ".venv\Scripts\python.exe"

if (!(Test-Path $Python)) {
  throw "Backend virtualenv not found. Run: <python> -m venv backend\.venv; backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt"
}

Push-Location $Backend
try {
  & $Python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
}
finally {
  Pop-Location
}
