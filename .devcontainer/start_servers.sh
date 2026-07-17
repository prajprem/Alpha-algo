#!/bin/bash
set -e
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Express Backend (port 5000) ==="
node server.js &
EXPRESS_PID=$!

sleep 1
echo "=== Python FastAPI (port 8000) ==="
cd server && python3 main.py &
PYTHON_PID=$!
cd "$ROOT_DIR"

sleep 4
echo "=== Vite Frontend (port 5173) ==="
npx vite --host 0.0.0.0 &
VITE_PID=$!

echo ""
echo "All servers started!"
echo "  Express:  http://localhost:5000"
echo "  Python:   http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo ""

wait $EXPRESS_PID $PYTHON_PID $VITE_PID
