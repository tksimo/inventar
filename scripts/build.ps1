# Inventar - local build helper for Windows PowerShell.
#
# Produces frontend\dist\ so the Dockerfile's COPY step has content.
# Run this BEFORE docker build.
#
# Usage:
#   .\scripts\build.ps1
#   .\scripts\build.ps1 -Clean

param(
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$FrontendDir = Join-Path $RepoRoot "frontend"

if (-not (Test-Path $FrontendDir)) {
    Write-Error "frontend directory not found at $FrontendDir"
    exit 1
}

if ($Clean) {
    Write-Host "==> cleaning frontend\node_modules"
    Remove-Item -Recurse -Force (Join-Path $FrontendDir "node_modules") -ErrorAction SilentlyContinue
}

Write-Host "==> installing frontend dependencies"
Push-Location $FrontendDir
try {
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

    Write-Host "==> building frontend"
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
}
finally {
    Pop-Location
}

$IndexHtml = Join-Path $FrontendDir "dist\index.html"
if (-not (Test-Path $IndexHtml)) {
    Write-Error "frontend\dist\index.html was not produced"
    exit 2
}

Write-Host "==> build complete: $FrontendDir\dist"
Write-Host "    You can now run: docker build -t inventar-addon ."
