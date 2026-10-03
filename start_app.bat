@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

REM ===================================================
REM   Typhoon OCR - Local Studio Launcher
REM   Version: 1.1.4
REM ===================================================

cd /d "%~dp0"
set "PROJECT_DIR=%CD%"

cls
echo.
echo   ===========================================================
echo     TYPHOON OCR - Local Studio Launcher
echo   ===========================================================
echo     Directory: %PROJECT_DIR%
echo.

REM -------------------------------------------------------------
REM [1/4] Environment Validation
REM -------------------------------------------------------------
echo   [1/4] Checking environment configuration...

if not exist ".env" (
    if exist ".env.template" (
        echo   [..] .env not found. Automatically creating from .env.template...
        copy .env.template .env >nul
        echo   [OK] .env file initialized from template.
    ) else (
        echo   [!] Error: Neither .env nor .env.template configuration file found.
        goto :error_exit
    )
)

findstr /C:"TYPHOON_API_KEY=" .env >nul
if !ERRORLEVEL! neq 0 (
    echo   [!] Warning: TYPHOON_API_KEY is not defined in .env
    echo       The studio will open, but OCR requests may fail without an API key.
)

REM Check for Port Conflicts (Port 8345 - Backend)
netstat -ano | findstr /C:":8345 " | findstr LISTENING >nul
if !ERRORLEVEL! equ 0 (
    echo   [!] Error: Port 8345 is already in use by another process.
    echo       Please terminate the service on port 8345 and try again.
    goto :error_exit
)

REM Check for Port Conflicts (Port 3000 - Frontend)
netstat -ano | findstr /C:":3000 " | findstr LISTENING >nul
if !ERRORLEVEL! equ 0 (
    echo   [!] Notice: Port 3000 is already in use.
    echo       Next.js will automatically select an available port such as 3001.
)

REM Check for Hyper-V reserved ports (WinError 10013)
netsh int ipv4 show excludedportrange protocol=tcp | findstr "8345" >nul
if !ERRORLEVEL! equ 0 (
    echo   [!] Error: Port 8345 falls within Windows Hyper-V excluded port range.
    echo       Run netsh int ipv4 show excludedportrange protocol=tcp to inspect ranges.
    goto :error_exit
)

echo   [OK] Environment verified.
echo.

REM -------------------------------------------------------------
REM [2/4] Runtime & Dependency Detection
REM -------------------------------------------------------------
echo   [2/4] Detecting Python and Node runtimes...

set "VENV_PATH="
if exist "venv\Scripts\activate.bat" ( set "VENV_PATH=venv" )
if not defined VENV_PATH if exist ".venv\Scripts\activate.bat" ( set "VENV_PATH=.venv" )
if not defined VENV_PATH if exist "env\Scripts\activate.bat" ( set "VENV_PATH=env" )

if defined VENV_PATH (
    echo   [OK] Python virtual environment: !VENV_PATH!
    set "VENV_CMD=call !VENV_PATH!\Scripts\activate.bat"
    set "PYTHON_EXE=!VENV_PATH!\Scripts\python.exe"
) else (
    echo   [!] Notice: No venv detected. Falling back to system Python.
    set "VENV_CMD=echo Using System Python"
    set "PYTHON_EXE=python"
)

REM Verify Node.js presence
where node >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo   [!] Error: Node.js executable not found in PATH.
    echo       Please install Node.js 18 or newer to run the frontend.
    goto :error_exit
)

REM Add local Poppler binaries to PATH if present
set "LOCAL_POPPLER=%PROJECT_DIR%\poppler\poppler-24.08.0\Library\bin"
if exist "!LOCAL_POPPLER!" (
    set "PATH=!LOCAL_POPPLER!;!PATH!"
    echo   [OK] Poppler binaries linked to PATH.
)

REM Check backend Python dependencies
echo   [..] Checking backend package dependencies...
if defined VENV_PATH (
    "!PYTHON_EXE!" -c "import fastapi, uvicorn, openai, typhoon_ocr" >nul 2>&1
    if !ERRORLEVEL! neq 0 (
        echo   [..] Installing missing Python requirements...
        call !VENV_PATH!\Scripts\activate.bat && pip install -r requirements.txt -r backend/requirements.txt -q
    )
)
echo   [OK] Runtime dependencies validated.
echo.

REM -------------------------------------------------------------
REM [3/4] Launching Services
REM -------------------------------------------------------------
echo   [3/4] Initializing local background servers...

REM Start Backend API Server
start "Typhoon OCR - Backend (Port 8345)" cmd /k "title Typhoon OCR Backend && cd /d "%PROJECT_DIR%" && !VENV_CMD! && python -m uvicorn backend.main:app --reload --port 8345"

REM Install node dependencies if missing
if not exist "node_modules" if not exist "frontend\node_modules" (
    echo   [..] First-time setup: Installing package dependencies...
    call npm install
)

REM Start Frontend Web Studio
start "Typhoon OCR - Frontend (Port 3000)" cmd /k "title Typhoon OCR Frontend && cd /d "%PROJECT_DIR%\frontend" && npm run dev"

echo   [OK] Both backend and frontend services initiated.
echo.

REM -------------------------------------------------------------
REM [4/4] Ready & Studio Launch
REM -------------------------------------------------------------
echo   [4/4] Studio ready.
echo.
echo   -----------------------------------------------------------
echo     * Backend API   : http://localhost:8345
echo     * Web Studio    : http://localhost:3000
echo     * API Docs      : http://localhost:8345/docs
echo   -----------------------------------------------------------
echo.
echo   Opening Web Studio in default browser in 3 seconds...
ping -n 4 127.0.0.1 >nul
start http://localhost:3000

echo.
echo   ===========================================================
echo     [OK] Background servers are running in separate windows.
echo     You may minimize this window or press any key to close it.
echo   ===========================================================
echo.
pause
exit /b 0

:error_exit
echo.
echo   ===========================================================
echo   [!] Startup Failed. Please review the diagnostic log above.
echo   ===========================================================
echo.
echo   Press any key to exit...
pause
exit /b 1