@echo off
title HUN - Instalar Servicio 24/7 con PM2 en Windows
color 0e

set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

echo =====================================================================
echo    Configurando Servicio 24/7 con PM2 para Windows Server
echo =====================================================================
echo.

call npm install -g pm2 pm2-windows-startup
if errorlevel 1 (
  echo [ERROR] Ejecuta este script con Clic Derecho -> "Ejecutar como Administrador".
  pause
  exit /b 1
)

call pm2-startup install
call pm2 delete hun-chatbot-server >nul 2>&1
call pm2 start "%~dp0ecosystem.config.cjs"
call pm2 save

echo.
echo =====================================================================
echo    Servicio "hun-chatbot-server" activo en segundo plano 24/7.
echo    Comandos utiles:
echo      pm2 status                 (Ver estado del servidor)
echo      pm2 logs hun-chatbot-server (Ver logs en vivo)
echo      pm2 restart hun-chatbot-server (Reiniciar servidor)
echo =====================================================================
echo.
pause
