@echo off
cd /d "%~dp0"

REM Fecha eventuais servidores anteriores na porta 8000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM Inicia o servidor HTTP em background invisivel via powershell sem janela
start "" powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8000

REM Aguarda 1 segundo
timeout /t 1 /nobreak >nul

REM Abre o Edge em modo KIOSK REAL (tela cheia nativa sem barra de titulo, sem bordas, sem abas)
start "" msedge --kiosk "http://localhost:8000" --edge-kiosk-type=fullscreen --no-first-run --disable-features=TranslateUI

exit
