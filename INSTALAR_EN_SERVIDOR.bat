@echo off
setlocal EnableDelayedExpansion
title HUN - Instalacion y Preparacion en Servidor Windows (Modo Endpoints)
color 0b

echo =====================================================================
echo    HOSPITAL UNIVERSITARIO NACIONAL DE COLOMBIA (HUN)
echo    Instalador y Compilador de Produccion (100%% Conexion por Endpoints)
echo =====================================================================
echo.

set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado en este servidor.
  echo Descarga e instala Node.js v20 LTS desde: https://nodejs.org/
  pause
  exit /b 1
)

echo [1/5] Verificando archivo de configuracion backend\.env...
if not exist "backend\.env" (
  if exist "backend\.env.production" (
    copy /Y "backend\.env.production" "backend\.env" >nul
    echo       Creado backend\.env a partir de backend\.env.production
  ) else if exist "backend\.env.example" (
    copy /Y "backend\.env.example" "backend\.env" >nul
    echo       Creado backend\.env a partir de backend\.env.example
  )
)

echo [2/5] Instalando dependencias del Backend y generando cliente Prisma...
cd /d "%~dp0backend"
call npm install
if errorlevel 1 (
  echo [ERROR] Fallo npm install en backend.
  pause
  exit /b 1
)
call npx prisma generate

echo [3/5] Sincronizando esquema con PostgreSQL (Contactos, Sesiones y Chat)...
call npx prisma db push
if errorlevel 1 (
  echo [AVISO] PostgreSQL aun no responde o requiere ajustar DATABASE_URL en backend\.env.
  echo         El servidor operara con los Endpoints de Hosvital en tiempo real.
) else (
  echo       Esquema PostgreSQL sincronizado. Asegurando usuarios del Dashboard...
  call npm run prisma:seed
)

echo [4/5] Instalando dependencias del Frontend...
cd /d "%~dp0frontend"
call npm install --include=optional
if errorlevel 1 (
  echo [ERROR] Fallo npm install en frontend.
  pause
  exit /b 1
)

echo [5/5] Compilando Backend (TypeScript) y Frontend (React/Vite) para Produccion...
cd /d "%~dp0"
call npm --prefix backend run build
if errorlevel 1 (
  echo [ERROR] Fallo la compilacion del Backend.
  pause
  exit /b 1
)
call npm --prefix frontend run build
if errorlevel 1 (
  echo [ERROR] Fallo la compilacion del Frontend.
  pause
  exit /b 1
)

echo.
echo =====================================================================
echo    INSTALACION Y COMPILACION COMPLETADAS (MODO 100%% ENDPOINTS)
echo    - Para iniciar en modo produccion: ejecuta INICIAR_PRODUCCION.bat
echo    - Para dejarlo como servicio 24/7: ejecuta INSTALAR_SERVICIO_24_7.bat
echo =====================================================================
echo.
pause
