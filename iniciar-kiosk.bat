@echo off
cd /d "%~dp0"

REM Finaliza possiveis instancias antigas
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM Inicia o servidor HTTP em background oculto
start "" powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8000

timeout /t 1 /nobreak >nul

REM Monitor 1 (Display Primario X=0): Tela cheia com a grade de escolha
start "" msedge --user-data-dir="%LOCALAPPDATA%\EdgeWallpaper_M1" --window-position=0,0 --kiosk "http://localhost:8000/?monitor=1" --edge-kiosk-type=fullscreen --no-first-run

REM Monitor 2 (Display Secundario X=1920): Tela cheia tambem com a grade de escolha para escolher direto nele
start "" msedge --user-data-dir="%LOCALAPPDATA%\EdgeWallpaper_M2" --window-position=1920,0 --kiosk "http://localhost:8000/?monitor=2" --edge-kiosk-type=fullscreen --no-first-run

exit
