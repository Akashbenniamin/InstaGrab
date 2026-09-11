@echo off
setlocal
title InstaGrab - Quick Start

echo.
echo  ==========================================
echo   InstaGrab - Quick Start
echo  ==========================================
echo.

:: Check prerequisites
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found. Install from https://python.org
    pause
    exit /b 1
)

set "ROOT=%~dp0"

:: Step 1: Install frontend dependencies if needed
if not exist "%ROOT%frontend\node_modules" (
    echo [1/3] Installing frontend dependencies...
    cd /d "%ROOT%frontend"
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
) else (
    echo [1/3] Frontend dependencies already installed.
)

:: Step 2: Install Python dependencies if needed
echo [2/3] Checking Python dependencies...
python -c "import flask; import yt_dlp; import pystray; import waitress" 2>nul
if %ERRORLEVEL% neq 0 (
    echo Installing Python dependencies...
    pip install -r "%ROOT%local-helper\requirements.txt" --quiet
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] pip install failed.
        pause
        exit /b 1
    )
)

:: Step 3: Launch both services
echo [3/3] Starting services...
echo.
echo  Starting local helper on http://127.0.0.1:18765
echo  Starting frontend on    http://localhost:5173
echo.
echo  ==========================================
echo   Once both are running:
echo   1. Open http://localhost:5173 in Chrome
echo   2. Look for the InstaGrab tray icon
echo   3. Right-click tray icon for pairing code
echo   4. Enter the code on the website
echo   5. Paste an Instagram URL and download!
echo  ==========================================
echo.
echo  Press Ctrl+C in either window to stop.
echo.

:: Start helper in a new window
start "InstaGrab Helper" cmd /k "cd /d "%ROOT%local-helper" && python src/main.py"

:: Small delay so helper starts first
timeout /t 2 /nobreak >nul

:: Start frontend dev server in a new window
start "InstaGrab Frontend" cmd /k "cd /d "%ROOT%frontend" && npx vite --host"

:: Wait 2 seconds for Vite to initialize, then open the browser automatically
timeout /t 2 /nobreak >nul
start http://localhost:5173

echo Both services launched in separate windows and your browser was opened.
echo.
pause
