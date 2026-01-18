@echo off
setlocal

title Typhoon OCR Launcher
echo ========================================================
echo        Typhoon OCR - One-Click Startup Script
echo ========================================================
echo.

REM --- 1. Environment Check ---
echo [1/4] Checking Environment...

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.10+ from python.org
    pause
    exit /b
)
echo [OK] Python detected.

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
set "VENV_CMD="

if exist "venv\Scripts\activate.bat" (
    set "VENV_CMD=call venv\Scripts\activate.bat"
    echo [INFO] Found virtual environment: venv
    goto :StartBackend
)
if exist ".venv\Scripts\activate.bat" (
    set "VENV_CMD=call .venv\Scripts\activate.bat"
    echo [INFO] Found virtual environment: .venv
    goto :StartBackend
)
if exist "env\Scripts\activate.bat" (
    set "VENV_CMD=call env\Scripts\activate.bat"
    echo [INFO] Found virtual environment: env
    goto :StartBackend
)

echo [WARNING] No virtual environment found. Using Global Python.
set "VENV_CMD=echo Using Global Python"

:StartBackend
echo.

REM --- 3. Start Backend ---
echo [3/4] Starting Backend Server...
if not exist "backend\main.py" (
    echo [ERROR] backend/main.py not found. Are you in the project root?
    pause
    exit /b
)

REM Launch Backend in new window
start "Typhoon OCR Backend" cmd /k "%VENV_CMD% && python -m uvicorn backend.main:app --reload --port 8000"

REM --- 4. Start Frontend ---
echo [4/4] Starting Frontend Server...
if not exist "frontend" (
    echo [ERROR] frontend directory not found.
    pause
    exit /b
)

cd frontend
if not exist "node_modules" (
    echo [WARNING] node_modules not found. Running npm install...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        cd ..
        pause
        exit /b
    )
)

REM Launch Frontend in new window
start "Typhoon OCR Frontend" cmd /k "npm run dev"
cd ..

REM --- 5. Open Browser ---
echo.
echo Launching Browser in 5 seconds...
timeout /t 5 >nul
start http://localhost:3000

echo.
echo ========================================================
echo  Typhoon OCR is running!
echo ========================================================
echo.
echo Please keep the two new terminal windows open.
echo You can close this launcher window.
echo.
pause
