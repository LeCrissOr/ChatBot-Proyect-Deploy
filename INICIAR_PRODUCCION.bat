@echo off
setlocal EnableDelayedExpansion
title HUN - Servidor Unificado de Produccion (Puerto 3001)
color 0a

echo =====================================================================
echo    HOSPITAL UNIVERSITARIO NACIONAL DE COLOMBIA (HUN)
echo    Servidor de Produccion (Backend + Dashboard + WebSockets + WhatsApp)
echo =====================================================================
echo.

set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

if not exist "backend\node_modules" (
  echo [INFO] Primera ejecucion en este servidor. Instalando dependencias...
  call "%~dp0INSTALAR_EN_SERVIDOR.bat"
)

if not exist "backend\dist\server.js" (
  echo [INFO] Compilacion de produccion no encontrada. Ejecutando INSTALAR_EN_SERVIDOR.bat...
  call "%~dp0INSTALAR_EN_SERVIDOR.bat"
) else (
  echo [INFO] Compilando ultimos cambios de TypeScript del Backend...
  cd /d "%~dp0backend"
  call npm run build
  cd /d "%~dp0"
)

echo Verificando si el puerto 3001 ya esta activo...
netstat -ano | findstr /R /C:":3001 .*LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo [INFO] Se detecto un proceso previo activo en el puerto 3001.
  echo Reiniciando el proceso para aplicar la version actualizada...
  for /f "tokens=5" %%a in ('netstat -aon ^| findstr /R /C:":3001 .*LISTENING"') do taskkill /f /pid %%a >nul 2>&1
  timeout /t 2 /nobreak >nul
)

echo Iniciando Servidor Unificado HUN en http://localhost:3001 ...
start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3001"
cd /d "%~dp0backend"
set NODE_ENV=production
node dist/server.js
pause
