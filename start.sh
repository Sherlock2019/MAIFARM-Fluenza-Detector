#!/usr/bin/env bash
# Starts AIFARM DOCTOR.
#
#   ./start.sh           development mode: backend (FastAPI) + frontend dev server (Vite)
#   ./start.sh --prod    server mode (AWS EC2 etc.): builds the frontend once and serves
#                        everything from one port, reachable from other machines
#
# The application is opened on port 5500 in both modes (the dev backend uses 8000 internally).
# If a port is busy the next free one is used. Override with AIFARM_WEB_PORT / AIFARM_API_PORT.
set -euo pipefail
cd "$(dirname "$0")"

MODE=dev
[ "${1:-}" = "--prod" ] && MODE=prod

# ---------------------------------------------------------------- prerequisites
if command -v apt-get >/dev/null; then
  PKG_HINT="sudo apt-get update && sudo apt-get install -y python3 python3-venv python3-pip nodejs npm"
elif command -v dnf >/dev/null; then
  PKG_HINT="sudo dnf install -y python3 python3-pip nodejs npm"
else
  PKG_HINT="install Python 3.9+ and Node.js 18+"
fi
fail() { echo "ERROR: $1"; echo "  Fix: $PKG_HINT"; exit 1; }

command -v python3 >/dev/null || fail "python3 is not installed."
python3 -c 'import sys; sys.exit(sys.version_info < (3, 9))' || fail "Python 3.9 or newer is required (found $(python3 -V 2>&1))."
command -v npm >/dev/null || fail "Node.js / npm is not installed."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "ERROR: Node.js 18 or newer is required (found $(node -v))."
  echo "  Fix: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  exit 1
fi

if [ ! -x backend/.venv/bin/python ]; then
  echo "==> Creating Python environment"
  rm -rf backend/.venv
  python3 -m venv backend/.venv || fail "Could not create a Python virtual environment (python3-venv missing?)."
fi
echo "==> Checking backend dependencies"
backend/.venv/bin/python -m pip install -q --disable-pip-version-check -r backend/requirements.txt

# (re)install when dependencies are missing or package-lock.json changed, e.g. after `git pull`
if [ ! -f frontend/node_modules/.package-lock.json ] || [ frontend/package-lock.json -nt frontend/node_modules/.package-lock.json ]; then
  echo "==> Installing frontend dependencies"
  (cd frontend && npm install --no-fund --no-audit)
fi

free_port() {  # first free TCP port at or above $1
  python3 - "$1" <<'PY'
import socket, sys
port = int(sys.argv[1])
while True:
    with socket.socket() as s:
        try:
            s.bind(("0.0.0.0", port))
            print(port)
            break
        except OSError:
            port += 1
PY
}
export AIFARM_WEB_PORT="$(free_port "${AIFARM_WEB_PORT:-5500}")"

cleanup() { kill "${BACKEND_PID:-}" "${FRONTEND_PID:-}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------- server mode (one port)
if [ "$MODE" = prod ]; then
  echo "==> Building frontend"
  (cd frontend && npm run build)

  # On EC2, ask the instance metadata service for the public address (silently skipped elsewhere).
  PUBLIC_IP=""
  if command -v curl >/dev/null; then
    TOKEN="$(curl -s -m 2 -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' 2>/dev/null || true)"
    if [ -n "$TOKEN" ]; then
      PUBLIC_IP="$(curl -s -m 2 -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)"
      case "$PUBLIC_IP" in *[!0-9.]*|"") PUBLIC_IP="" ;; esac
    fi
  fi

  echo
  echo "  AIFARM DOCTOR is running on port $AIFARM_WEB_PORT"
  echo "    On this machine:  http://localhost:$AIFARM_WEB_PORT"
  if [ -n "$PUBLIC_IP" ]; then
    echo "    From outside:     http://$PUBLIC_IP:$AIFARM_WEB_PORT"
    echo "    (allow inbound TCP $AIFARM_WEB_PORT in the EC2 security group)"
  fi
  echo "  Press Ctrl+C to stop."
  echo
  cd backend
  exec .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "$AIFARM_WEB_PORT"
fi

# ---------------------------------------------------------------- development mode
export AIFARM_API_PORT="$(free_port "${AIFARM_API_PORT:-8000}")"

echo "==> Starting backend on http://localhost:$AIFARM_API_PORT"
(cd backend && exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port "$AIFARM_API_PORT") &
BACKEND_PID=$!

echo "==> Starting frontend on http://localhost:$AIFARM_WEB_PORT"
(cd frontend && exec npm run dev -- --strictPort) &
FRONTEND_PID=$!

echo
echo "  AIFARM DOCTOR is starting. Open http://localhost:$AIFARM_WEB_PORT"
echo "  (from another machine: http://<this-server-address>:$AIFARM_WEB_PORT)"
echo "  Press Ctrl+C to stop."
echo
wait -n "$BACKEND_PID" "$FRONTEND_PID"
