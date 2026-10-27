@echo off
setlocal EnableDelayedExpansion
title HUN - Generar Nuevo Codigo QR de WhatsApp
color 0b

echo =====================================================================
echo    HOSPITAL UNIVERSITARIO NACIONAL DE COLOMBIA (HUN)
echo    Generador de Nuevo Codigo QR para WhatsApp Business
echo =====================================================================
echo.

set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

echo [1/3] Cerrando procesos previos en el puerto 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /R /C:":3001 .*LISTENING"') do taskkill /f /pid %%a >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Eliminando credenciales anteriores (auth_info_baileys)...
if exist "backend\auth_info_baileys" (
  rmdir /s /q "backend\auth_info_baileys"
)
if exist "auth_info_baileys" (
  rmdir /s /q "auth_info_baileys"
)

echo [3/3] Iniciando Servidor HUN para generar codigo QR limpio...
start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3001"
cd /d "%~dp0backend"
set NODE_ENV=production
node dist/server.js
pause
