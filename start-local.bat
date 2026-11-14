@echo off
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js and npm are required. Install Node.js 20.3 or later, then run this file again.
  pause
  exit /b 1
)
call npm run dev -- --host 127.0.0.1 --port 8080 --strictPort --open
