@echo off
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python 3 was not found. Install Python or run a different local HTTP server.
  pause
  exit /b 1
)
start "Aloop local site" http://127.0.0.1:8080/
python -m http.server 8080 --bind 127.0.0.1
