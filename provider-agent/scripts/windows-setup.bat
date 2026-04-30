@echo off
setlocal EnableDelayedExpansion

echo ============================================
echo   StoraChain Provider Installer (Windows)
echo ============================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [1/4] Node.js not found. Installing Node.js automatically...
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi' -OutFile 'node_installer.msi'"
    if exist "node_installer.msi" (
        echo Please wait, installing Node.js in the background...
        msiexec /i node_installer.msi /quiet /norestart
        del node_installer.msi
        
        :: Refresh path to use node immediately
        set "PATH=%PATH%;C:\Program Files\nodejs\"
    ) else (
        echo Failed to download Node.js. Please install it manually.
        pause
        exit /b 1
    )
) else (
    echo [1/4] Node.js is already installed.
)

echo [2/4] Creating agent directory...
if not exist "storachain-agent" mkdir storachain-agent
cd storachain-agent

echo [3/4] Downloading agent files...

set "REPO_BASE=https://raw.githubusercontent.com/MiyuruDilakshan/StoraChain/main/provider-agent"

powershell -Command "Invoke-WebRequest -Uri '!REPO_BASE!/agent.js' -OutFile 'agent.js'"
if not exist "src" mkdir src
powershell -Command "Invoke-WebRequest -Uri '!REPO_BASE!/src/server.js' -OutFile 'src/server.js'"
powershell -Command "Invoke-WebRequest -Uri '!REPO_BASE!/src/storage.js' -OutFile 'src/storage.js'"
powershell -Command "Invoke-WebRequest -Uri '!REPO_BASE!/src/registry.js' -OutFile 'src/registry.js'"
if not exist "scripts" mkdir scripts
powershell -Command "Invoke-WebRequest -Uri '!REPO_BASE!/scripts/setup-wizard.js' -OutFile 'scripts/setup-wizard.js'"

echo [4/4] Installing dependencies...
if not exist "package.json" (
    call npm init -y >nul 2>nul
)
call npm install axios dotenv express uuid pm2 >nul 2>nul

echo.
echo Starting the automated setup wizard...
node scripts/setup-wizard.js

pause
