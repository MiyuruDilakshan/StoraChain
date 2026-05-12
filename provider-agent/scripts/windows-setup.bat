@echo off
setlocal EnableDelayedExpansion

echo ============================================================
echo   StoraChain Provider Agent Installer - Windows
echo   IMPORTANT: Run this as Administrator!
echo ============================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [1/4] Installing Node.js automatically...
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi' -OutFile '%TEMP%\node_installer.msi'"
    msiexec /i "%TEMP%\node_installer.msi" /quiet /norestart
    del "%TEMP%\node_installer.msi" >nul 2>nul
    set "PATH=%PATH%;C:\Program Files\nodejs\"
    echo [1/4] Node.js installed.
) else (
    echo [1/4] Node.js found: OK
)

echo [2/4] Creating agent directory...
set "AGENT_DEST=%USERPROFILE%\storachain-agent"
if not exist "%AGENT_DEST%"         mkdir "%AGENT_DEST%"
if not exist "%AGENT_DEST%\src"     mkdir "%AGENT_DEST%\src"
if not exist "%AGENT_DEST%\scripts" mkdir "%AGENT_DEST%\scripts"

echo [3/4] Downloading agent files from GitHub...
set "REPO=https://raw.githubusercontent.com/MiyuruDilakshan/StoraChain/main/provider-agent"
powershell -Command "Invoke-WebRequest -Uri '%REPO%/agent.js'                -OutFile '%AGENT_DEST%\agent.js'                -UseBasicParsing"
powershell -Command "Invoke-WebRequest -Uri '%REPO%/src/server.js'           -OutFile '%AGENT_DEST%\src\server.js'           -UseBasicParsing"
powershell -Command "Invoke-WebRequest -Uri '%REPO%/src/storage.js'          -OutFile '%AGENT_DEST%\src\storage.js'          -UseBasicParsing"
powershell -Command "Invoke-WebRequest -Uri '%REPO%/src/registry.js'         -OutFile '%AGENT_DEST%\src\registry.js'         -UseBasicParsing"
powershell -Command "Invoke-WebRequest -Uri '%REPO%/src/integrity.js'        -OutFile '%AGENT_DEST%\src\integrity.js'        -UseBasicParsing"
powershell -Command "Invoke-WebRequest -Uri '%REPO%/scripts/setup-wizard.js' -OutFile '%AGENT_DEST%\scripts\setup-wizard.js' -UseBasicParsing"

if not exist "%AGENT_DEST%\agent.js" (
    echo ERROR: Download failed. Check your internet connection and try again.
    pause
    exit /b 1
)

echo [4/4] Installing dependencies...
cd /d "%AGENT_DEST%"
call npm init -y >nul 2>nul
call npm install axios dotenv express uuid >nul 2>nul

echo.
echo ============================================================
echo   Setup wizard starting...
echo   You only need your StoraChain email and password.
echo ============================================================
echo.

node scripts/setup-wizard.js --backend "https://api.storachain.miyuru.dev"

echo.
pause
