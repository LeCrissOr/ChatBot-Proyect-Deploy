@echo off
title HUN - Actualizar Servidor desde GitHub
color 0b

set "PATH=C:\Program Files\nodejs;C:\Program Files\Git\cmd;%PATH%"
cd /d "%~dp0"

echo =====================================================================
echo    HOSPITAL UNIVERSITARIO NACIONAL DE COLOMBIA (HUN)
echo    Actualizador Automatico desde GitHub (git pull + build + restart)
echo =====================================================================
echo.

echo [1/4] Descargando ultimos cambios desde GitHub...
git pull
if errorlevel 1 (
  echo [ERROR] No se pudo ejecutar git pull. Verifica la conexion o estado del repositorio.
  pause
  exit /b 1
)

echo [2/4] Verificando dependencias y esquema Prisma...
cd /d "%~dp0backend"
call npm install
call npx prisma generate
call npx prisma db push

cd /d "%~dp0frontend"
call npm install --include=optional

echo [3/4] Compilando Backend y Frontend de Produccion...
cd /d "%~dp0"
call npm --prefix backend run build
call npm --prefix frontend run build

echo [4/4] Reiniciando servicio en PM2 (si esta activo)...
where pm2 >nul 2>&1
if not errorlevel 1 (
  call pm2 restart hun-chatbot-server >nul 2>&1
)

echo.
echo =====================================================================
echo    SERVIDOR ACTUALIZADO EXITOSAMENTE A LA ULTIMA VERSION
echo =====================================================================
echo.
pause
