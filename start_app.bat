@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

REM ===================================================
REM   Typhoon OCR - Startup Script
REM   Version: 1.0.5
REM   Fix: Escaped parentheses in echo statements
REM ===================================================

cd /d "%~dp0"
set "PROJECT_DIR=%CD%"

cls
echo.
echo   ╔═══════════════════════════════════════════════════════╗
echo   ║           🌊 Typhoon OCR - Startup Script             ║
echo   ╚═══════════════════════════════════════════════════════╝
echo.
echo   📁 Project: %PROJECT_DIR%
echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM [1/4] Environment Validation
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   [1/4] Validating Environment...

if not exist ".env" (
    echo   [!] Error: .env file not found.
    echo       Please create a .env file from .env.template
    goto :error_exit
)

findstr /C:"TYPHOON_API_KEY=" .env >nul
if !ERRORLEVEL! neq 0 (
    echo   [!] Warning: TYPHOON_API_KEY not found in .env
    pause
)

REM Check for Port Conflicts
netstat -ano | findstr :8345 >nul
if !ERRORLEVEL! equ 0 (
    echo   [!] Error: Port 8345 is already in use.
    echo       Please stop the process using it and try again.
    goto :error_exit
)

REM Check for Hyper-V reserved ports (WinError 10013)
netsh int ipv4 show excludedportrange protocol=tcp | findstr "8345" >nul
if !ERRORLEVEL! equ 0 (
    echo   [!] Error: Port 8345 is reserved by Windows ^(Hyper-V^).
    echo       Please run 'netsh int ipv4 show excludedportrange protocol=tcp' to see reserved ranges.
    goto :error_exit
)

echo   [OK] Environment validated.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM [2/4] Virtual Environment Detection
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   [2/4] Detecting Virtual Environment...

set "VENV_PATH="
if exist "venv\Scripts\activate.bat" ( set "VENV_PATH=venv" )
if not defined VENV_PATH if exist ".venv\Scripts\activate.bat" ( set "VENV_PATH=.venv" )
if not defined VENV_PATH if exist "env\Scripts\activate.bat" ( set "VENV_PATH=env" )

if defined VENV_PATH (
    echo   [OK] Virtual Environment found: !VENV_PATH!
    set "VENV_CMD=call "!VENV_PATH!\Scripts\activate.bat""
    set "PYTHON_EXE="!VENV_PATH!\Scripts\python.exe""
) else (
    echo   [!] Warning: No venv found. Using global Python.
    set "VENV_CMD=echo Using Global Python"
    set "PYTHON_EXE=python"
)

REM Add local Poppler to PATH
set "LOCAL_POPPLER=%PROJECT_DIR%\poppler\poppler-24.08.0\Library\bin"
if exist "!LOCAL_POPPLER!" (
    set "PATH=!LOCAL_POPPLER!;!PATH!"
    echo   [OK] Local Poppler added to PATH.
)

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM [3/4] Launching Servers
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   [3/4] Launching servers...

REM Check Node.js
where node >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo   [!] Error: Node.js not found. Please install Node.js 18+.
    goto :error_exit
)

REM Check dependencies and install if missing
echo   Checking backend dependencies...
if defined VENV_PATH (
    "!VENV_PATH!\Scripts\python.exe" -c "import fastapi, uvicorn, openai" >nul 2>&1
    if !ERRORLEVEL! neq 0 (
        echo   [!] Missing dependencies, installing...
        call "!VENV_PATH!\Scripts\activate.bat" && pip install -r requirements.txt -r backend/requirements.txt -q
    )
)

REM Start Backend
start "Typhoon Backend" cmd /k "title Typhoon Backend && cd /d "%PROJECT_DIR%" && !VENV_CMD! && python -m uvicorn backend.main:app --reload --port 8345"

REM Start Frontend
if not exist "frontend\node_modules" (
    echo   [!] node_modules not found, running npm install...
    cd /d "frontend" && call npm install && cd /d "%PROJECT_DIR%"
)
start "Typhoon Frontend" cmd /k "title Typhoon Frontend && cd /d "%PROJECT_DIR%\frontend" && npm run dev"

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM [4/4] Finalizing
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   [4/4] Finalizing...
echo.
echo   [SUCCESS] Both servers are starting up.
echo   - Backend: http://localhost:8345
echo   - Frontend: http://localhost:3000
echo.
echo   Launching browser in 5 seconds...
timeout /t 5 >nul
start http://localhost:3000

echo.
echo   You can safely close this window.
echo   Press any key to exit...
pause >nul
exit /b 0

:error_exit
echo.
echo   [!] Startup Failed. Please check the errors above.
pause
exit /b 1
