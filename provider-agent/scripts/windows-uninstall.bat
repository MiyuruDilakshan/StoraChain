@echo off
TITLE StoraChain Provider Agent - Uninstaller
echo.
echo   =============================================
echo      StoraChain Provider Agent - Uninstaller   
echo   =============================================
echo.

:: Check for Administrative privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo   [Admin privileges confirmed]
) else (
    echo   [!] Error: Please run this script as Administrator.
    pause
    exit /b 1
)

set AGENT_DIR=%USERPROFILE%\storachain-agent
cd /d "%AGENT_DIR%"

echo.
echo   [1/3] Stopping background services...
where pm2 >nul 2>nul
if %errorLevel% == 0 (
    call pm2 delete storachain-provider 2>nul
    call pm2 save 2>nul
)

echo   [2/3] Wiping local storage and releasing disk space...
if exist "agent.js" (
    node agent.js --uninstall
)

echo   [3/3] Removing agent directory...
cd /d "%USERPROFILE%"
if exist "storachain-agent" rd /s /q "storachain-agent"

echo.
echo   =============================================
echo    StoraChain Provider Agent Uninstalled!
echo    All chunks and reservations have been cleared.
echo   =============================================
echo.
pause
