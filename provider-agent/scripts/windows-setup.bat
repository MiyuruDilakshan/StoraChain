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
if not exist "storachain-agent" mkdir storachain-agent
cd storachain-agent

echo [3/4] Downloading agent files from StoraChain...

set "REPO=https://raw.githubusercontent.com/MiyuruDilakshan/StoraChain/main/provider-agent/scripts/storachain-agent"

powershell -Command "Invoke-WebRequest -Uri '!REPO!/agent.js' -OutFile 'agent.js' -UseBasicParsing" 2>nul
if not exist "src" mkdir src
powershell -Command "Invoke-WebRequest -Uri '!REPO!/src/server.js' -OutFile 'src\server.js' -UseBasicParsing" 2>nul
powershell -Command "Invoke-WebRequest -Uri '!REPO!/src/storage.js' -OutFile 'src\storage.js' -UseBasicParsing" 2>nul
powershell -Command "Invoke-WebRequest -Uri '!REPO!/src/registry.js' -OutFile 'src\registry.js' -UseBasicParsing" 2>nul
if not exist "scripts" mkdir scripts
powershell -Command "Invoke-WebRequest -Uri '!REPO!/scripts/setup-wizard.js' -OutFile 'scripts\setup-wizard.js' -UseBasicParsing" 2>nul

echo [4/4] Installing dependencies...
call npm init -y >nul 2>nul
call npm install axios dotenv express uuid >nul 2>nul

echo.
echo ============================================================
echo   Setup wizard starting...
echo   You only need your StoraChain email and password.
echo ============================================================
echo.

node scripts/setup-wizard.js

echo.
pause
