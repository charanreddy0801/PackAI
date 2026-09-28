@echo off
REM One-click launcher for Windows
cd /d "%~dp0backend"
if not exist .env (
  copy .env.example .env >nul
  echo Created backend\.env - open it, paste your GROQ_API_KEY, then run START.bat again.
  pause
  exit /b
)
if not exist node_modules call npm install
call npm start
