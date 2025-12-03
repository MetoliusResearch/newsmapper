#!/bin/bash
# Serve the project locally on port 8080

PORT=8080

# Check if port is in use and kill the process
PID=$(lsof -ti:$PORT)
if [ ! -z "$PID" ]; then
    echo "Port $PORT is already in use by process $PID. Killing it..."
    kill -9 $PID
    sleep 1
fi

echo "Starting local development server on http://localhost:$PORT"
echo "Press Ctrl+C to stop the server"
echo ""

npx http-server -p $PORT
