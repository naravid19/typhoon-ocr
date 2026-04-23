@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

REM ===================================================
REM   Typhoon OCR - Professional Startup Script
REM   Version: 1.1.0
REM   Features: Auto-detect venv, dependency check,
REM             colored output, professional UI
REM ===================================================

REM Navigate to script directory
cd /d "%~dp0"
set "PROJECT_DIR=%CD%"

REM Define colors (using PowerShell for colored output)
set "PS_CMD=powershell -NoProfile -Command"

cls
echo.
echo   ╔═══════════════════════════════════════════════════════╗
echo   ║           🌊 Typhoon OCR - Startup Script             ║
echo   ║           Professional Document Digitization          ║
echo   ╚═══════════════════════════════════════════════════════╝
echo.
echo   📁 Project: %PROJECT_DIR%
echo.

REM ===================================================
REM   DEPENDENCY CHECKS
REM ===================================================
echo   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   [0/3] Checking Dependencies...
echo.

REM Check Python
set "PYTHON_CMD="
where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "PYTHON_CMD=python"
) else (
    where py >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        set "PYTHON_CMD=py"
    )
)

if not defined PYTHON_CMD (
    echo   ❌ Python not found! Please install Python 3.10+
    echo      Download from: https://python.org
    goto :error_exit
) else (
    for /f "tokens=2 delims= " %%v in ('!PYTHON_CMD! --version 2^>^&1') do set "PYTHON_VER=%%v"
    echo   ✓ Python !PYTHON_VER!
)

REM Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   ❌ Node.js not found! Please install Node.js 18+
    echo      Download from: https://nodejs.org
    goto :error_exit
) else (
    for /f "tokens=1 delims= " %%v in ('node --version 2^>^&1') do set "NODE_VER=%%v"
    echo   ✓ Node.js !NODE_VER!
)

REM Check npm
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   ❌ npm not found! Please install npm
    goto :error_exit
) else (
    for /f "tokens=1 delims= " %%v in ('npm --version 2^>^&1') do set "NPM_VER=%%v"
    echo   ✓ npm !NPM_VER!
)

REM Check pdfinfo (Poppler) - Optional but recommended
where pdfinfo >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   ⚠ pdfinfo not found ^(optional^)
    echo     PDF processing may have limited functionality
) else (
    echo   ✓ pdfinfo ^(Poppler^) available
)

echo.
echo   ✓ All core dependencies satisfied!
echo.

REM ===================================================
REM   [1/3] VIRTUAL ENVIRONMENT DETECTION
REM ===================================================
echo   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   [1/3] Detecting Virtual Environment...

set "VENV_PATH="
set "VENV_NAME="

REM Check common venv folder names
if exist "%PROJECT_DIR%\venv\Scripts\activate.bat" (
    set "VENV_PATH=%PROJECT_DIR%\venv"
    set "VENV_NAME=venv"
    goto :venv_found
)
if exist "%PROJECT_DIR%\.venv\Scripts\activate.bat" (
    set "VENV_PATH=%PROJECT_DIR%\.venv"
    set "VENV_NAME=.venv"
    goto :venv_found
)
if exist "%PROJECT_DIR%\env\Scripts\activate.bat" (
    set "VENV_PATH=%PROJECT_DIR%\env"
    set "VENV_NAME=env"
    goto :venv_found
)

REM Auto-detect any venv
for /d %%D in ("%PROJECT_DIR%\*") do (
    if exist "%%D\Scripts\activate.bat" (
        set "VENV_PATH=%%D"
        for %%F in ("%%D") do set "VENV_NAME=%%~nxF"
        goto :venv_found
    )
)

echo   ⚠ No virtual environment found
echo     Using system Python...
set "VENV_CMD=echo Using Global Python"
goto :check_backend

:venv_found
echo   ✓ Virtual Environment: !VENV_NAME!
set "VENV_CMD=call "%VENV_PATH%\Scripts\activate.bat""
set "PYTHON_CMD=python"
echo.

REM ===================================================
REM   [2/3] START BACKEND (FastAPI + Uvicorn)
REM ===================================================
:check_backend
echo   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   [2/3] Starting Backend Server ^(FastAPI^)...

if not exist "%PROJECT_DIR%\backend\main.py" (
    echo   ❌ backend/main.py not found!
    echo      Make sure you're in the project root directory.
    goto :error_exit
)

REM Check if requirements are installed
if defined VENV_PATH (
    REM Quick check for critical packages
    "%VENV_PATH%\Scripts\python.exe" -c "import fastapi, uvicorn, PIL" >nul 2>&1
    if !ERRORLEVEL! neq 0 (
        echo   ⚠ Missing dependencies detected, installing...
        call "%VENV_PATH%\Scripts\activate.bat"
        pip install -r requirements.txt -q
        echo   ✓ Dependencies installed
    )
)

REM Launch Backend in new window with colored title
start "🔧 Typhoon OCR Backend" cmd /k "title 🔧 Typhoon OCR Backend && cd /d "%PROJECT_DIR%" && %VENV_CMD% && %PYTHON_CMD% -m uvicorn backend.main:app --reload --port 8123"

echo   ✓ Backend starting on http://localhost:8123
echo.

REM ===================================================
REM   [3/3] START FRONTEND (Next.js)
REM ===================================================
echo   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   [3/3] Starting Frontend Server ^(Next.js^)...

set "FRONTEND_DIR=%PROJECT_DIR%\frontend"
if not exist "%FRONTEND_DIR%\package.json" (
    echo   ❌ Frontend not found at: %FRONTEND_DIR%
    echo      Make sure the frontend directory exists.
    goto :error_exit
)

REM Check if node_modules exists
if not exist "%FRONTEND_DIR%\node_modules" (
    echo   ⚠ node_modules not found, running npm install...
    echo     This may take a few minutes...
    echo.
    cd /d "%FRONTEND_DIR%"
    call npm install
    if !ERRORLEVEL! neq 0 (
        echo   ❌ npm install failed!
        cd /d "%PROJECT_DIR%"
        goto :error_exit
    )
    echo   ✓ npm packages installed
    cd /d "%PROJECT_DIR%"
)

REM Launch Frontend in new window
start "🌐 Typhoon OCR Frontend" cmd /k "title 🌐 Typhoon OCR Frontend && cd /d "%FRONTEND_DIR%" && npm run dev"

echo   ✓ Frontend starting on http://localhost:3000
echo.

REM ===================================================
REM   LAUNCH BROWSER
REM ===================================================
echo   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   Launching browser in 5 seconds...
timeout /t 5 >nul
start http://localhost:3000

echo.
echo   ╔═══════════════════════════════════════════════════════╗
echo   ║              ✨ All servers started! ✨               ║
echo   ╠═══════════════════════════════════════════════════════╣
echo   ║  🔧 Backend:   http://localhost:8123                  ║
echo   ║  🌐 Frontend:  http://localhost:3000                  ║
echo   ║  📖 API Docs:  http://localhost:8123/docs             ║
echo   ╚═══════════════════════════════════════════════════════╝
echo.
echo   ┌───────────────────────────────────────────────────────┐
echo   │  💡 Tips:                                             │
echo   │  • Keep the two new terminal windows open             │
echo   │  • Press Ctrl+C in terminals to stop servers          │
echo   │  • This launcher window can be safely closed          │
echo   └───────────────────────────────────────────────────────┘
echo.
echo   Press any key to close this launcher...
pause >nul
goto :end

:error_exit
echo.
echo   ╔═══════════════════════════════════════════════════════╗
echo   ║          ❌ Startup Failed - Check Above ❌           ║
echo   ╚═══════════════════════════════════════════════════════╝
echo.
echo   Please resolve the issues above and try again.
echo.
pause
goto :end

:end
endlocal
exit /b 0
