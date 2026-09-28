#!/usr/bin/env bash
# One-click launcher for macOS / Linux
cd "$(dirname "$0")/backend" || exit 1
if [ ! -f .env ]; then cp .env.example .env; echo ">> Created backend/.env - open it and paste your GROQ_API_KEY, then run this again."; exit 0; fi
[ -d node_modules ] || npm install
npm start
