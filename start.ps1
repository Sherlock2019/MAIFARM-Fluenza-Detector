# Starts the AIFARM DOCTOR backend (FastAPI, port 8000) and frontend (Vite, port 5173).
# If the project lives inside WSL (\\wsl$\... or \\wsl.localhost\...), it is started inside WSL with start.sh.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($root -match '^(?:Microsoft\.PowerShell\.Core\\FileSystem::)?\\\\wsl(?:\$|\.localhost)\\([^\\]+)\\(.*)$') {
    $distro = $Matches[1]
    $linuxPath = '/' + ($Matches[2] -replace '\\', '/')
    Write-Host "Project is inside WSL ($distro). Starting it there..."
    Write-Host "Open the http://localhost:<port> address it prints once it is running. Press Ctrl+C to stop."
    wsl -d $distro -- bash -lc "cd '$linuxPath' && bash ./start.sh"
    exit $LASTEXITCODE
}

Set-Location $root
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw 'Python 3.10+ is required.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'Node.js 18+ (with npm) is required.' }

$venvPython = Join-Path $root 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    Write-Host '==> Creating Python environment'
    python -m venv (Join-Path $root 'backend\.venv')
}
Write-Host '==> Checking backend dependencies'
& $venvPython -m pip install -q -r (Join-Path $root 'backend\requirements.txt')

# (re)install when dependencies are missing or package-lock.json changed, e.g. after `git pull`
$installed = Join-Path $root 'frontend\node_modules\.package-lock.json'
$lock = Join-Path $root 'frontend\package-lock.json'
if (-not (Test-Path $installed) -or (Get-Item $lock).LastWriteTime -gt (Get-Item $installed).LastWriteTime) {
    Write-Host '==> Installing frontend dependencies'
    Push-Location (Join-Path $root 'frontend')
    npm install --no-fund --no-audit
    Pop-Location
}

function Get-FreePort([int]$port) {
    while ($true) {
        try {
            $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
            $listener.Start(); $listener.Stop()
            return $port
        } catch { $port++ }
    }
}
# The application is opened on port 5500 (backend uses 8000 internally); if one is busy the next free port is used.
$apiStart = 8000; if ($env:AIFARM_API_PORT) { $apiStart = [int]$env:AIFARM_API_PORT }
$webStart = 5500; if ($env:AIFARM_WEB_PORT) { $webStart = [int]$env:AIFARM_WEB_PORT }
$env:AIFARM_API_PORT = Get-FreePort $apiStart
$env:AIFARM_WEB_PORT = Get-FreePort $webStart

Write-Host "==> Starting backend on http://localhost:$($env:AIFARM_API_PORT)"
$backend = Start-Process -FilePath $venvPython -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', $env:AIFARM_API_PORT `
    -WorkingDirectory (Join-Path $root 'backend') -PassThru -NoNewWindow

Write-Host "==> Starting frontend on http://localhost:$($env:AIFARM_WEB_PORT)"
Write-Host ''
Write-Host "  AIFARM DOCTOR is starting. Open http://localhost:$($env:AIFARM_WEB_PORT)"
Write-Host '  Press Ctrl+C to stop.'
Write-Host ''
try {
    Push-Location (Join-Path $root 'frontend')
    npm run dev -- --strictPort
}
finally {
    Pop-Location
    if ($backend -and -not $backend.HasExited) { Stop-Process -Id $backend.Id -Force }
}
