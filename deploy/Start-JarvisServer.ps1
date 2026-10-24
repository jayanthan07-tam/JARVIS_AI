$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$environmentFile = Join-Path $projectRoot ".env.production.local"
if (-not (Test-Path -LiteralPath $environmentFile)) {
    throw "Missing .env.production.local. Copy .env.example there and configure the required server values first."
}

Set-Location -LiteralPath $projectRoot
$env:NODE_ENV = "production"
$env:JARVIS_DATA_DIR = Join-Path $projectRoot "data"
& npm.cmd run start -- --hostname 127.0.0.1 --port 3000
