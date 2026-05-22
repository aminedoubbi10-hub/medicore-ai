$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Frontend = Join-Path $Root "frontend"

Push-Location $Frontend
try {
  if (!(Test-Path "node_modules")) {
    npm.cmd install
  }
  npm.cmd run dev
}
finally {
  Pop-Location
}
