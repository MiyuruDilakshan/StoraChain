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

:: ── Locate source files ───────────────────────────────────────────────────────
:: This bat is inside: <project>\provider-agent\scripts\
:: So go up two levels to get the project root, then into provider-agent.
set "SCRIPT_DIR=%~dp0"
:: Remove trailing backslash
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
:: Go up one level from scripts\ → provider-agent\
for %%i in ("%SCRIPT_DIR%") do set "AGENT_SOURCE=%%~dpi"
set "AGENT_SOURCE=%AGENT_SOURCE:~0,-1%"

echo [2/4] Creating agent directory...
set "AGENT_DEST=%USERPROFILE%\storachain-agent"
if not exist "%AGENT_DEST%" mkdir "%AGENT_DEST%"
if not exist "%AGENT_DEST%\src" mkdir "%AGENT_DEST%\src"
if not exist "%AGENT_DEST%\scripts" mkdir "%AGENT_DEST%\scripts"

echo [3/4] Copying agent files from project...
copy /Y "%AGENT_SOURCE%\agent.js"              "%AGENT_DEST%\agent.js"              >nul
copy /Y "%AGENT_SOURCE%\src\server.js"         "%AGENT_DEST%\src\server.js"         >nul
copy /Y "%AGENT_SOURCE%\src\storage.js"        "%AGENT_DEST%\src\storage.js"        >nul
copy /Y "%AGENT_SOURCE%\src\registry.js"       "%AGENT_DEST%\src\registry.js"       >nul
copy /Y "%AGENT_SOURCE%\scripts\setup-wizard.js" "%AGENT_DEST%\scripts\setup-wizard.js" >nul

if not exist "%AGENT_DEST%\agent.js" (
    echo ERROR: Failed to copy agent files. Make sure this bat is inside the StoraChain project.
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
