@echo off
setlocal EnableDelayedExpansion

title Typhoon OCR Launcher
echo ========================================================
echo        Typhoon OCR - One-Click Startup Script
echo ========================================================
echo.

REM --- 1. Environment Check ---
echo [1/4] Checking Environment...

REM Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.10+ from python.org
    pause
    exit /b
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo [OK] %%v detected.

REM Check Node.js
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js 18+ from nodejs.org
    pause
    exit /b
)
echo [OK] Node.js detected.
echo.

REM --- 2. Virtual Environment Detection ---
echo [2/4] Detecting Virtual Environment...
set "VENV_ACTIVATE="

REM List of common venv names
for %%i in (venv .venv env) do (
    if exist "%%i\Scripts\activate.bat" (
        set "VENV_ACTIVATE=call %%i\Scripts\activate.bat"
        echo [INFO] Found virtual environment: %%i
        goto :FoundVenv
    )
)

:FoundVenv
if "%VENV_ACTIVATE%"=="" (
    echo [WARNING] No virtual environment found (venv, .venv, env).
    echo [INFO] Attempting to run with global Python...
    REM Just a dummy command to prevent syntax errors in concatenation later if we wanted strictness,
    REM but in the start command we can just omit it or keep it empty.
    REM Actually, to act like 'activate', we can just echo.
    set "VENV_ACTIVATE=echo Using Global Python"
)

echo.

REM --- 3. Start Backend ---
echo [3/4] Starting Backend Server...
if not exist "backend\main.py" (
    echo [ERROR] backend/main.py not found. Are you in the project root?
    pause
    exit /b
)

REM We use a separate cmd window for the backend
REM using "call" for activate to ensure it runs in the same context if it were a bat, though start cmd /k does that.
start "Typhoon OCR Backend" cmd /k "%VENV_ACTIVATE% && python -m uvicorn backend.main:app --reload --port 8000"

REM --- 4. Start Frontend ---
echo [4/4] Starting Frontend Server...
if not exist "frontend" (
    echo [ERROR] frontend directory not found.
    pause
    exit /b
)

cd frontend
if not exist "node_modules" (
    echo [WARNING] node_modules not found. Attempting to install dependencies...
    echo This may take a few minutes...
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] npm install failed.
        cd ..
        pause
        exit /b
    )
)

start "Typhoon OCR Frontend" cmd /k "npm run dev"
cd ..

REM --- 5. Open Browser ---
echo.
echo All servers launched. Opening browser in 5 seconds...
timeout /t 5 >nul
start http://localhost:3000

echo.
echo ========================================================
echo  Typhoon OCR is running!
echo  Backend: http://localhost:8000 (API Docs: /docs)
echo  Frontend: http://localhost:3000
echo ========================================================
echo.
echo Please keep the two new terminal windows open.
echo You can close this launcher window.
echo.
pause
