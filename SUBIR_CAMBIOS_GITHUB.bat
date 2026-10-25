@echo off
setlocal EnableDelayedExpansion
title HUN - Publicar Cambios a GitHub
color 0b

echo =====================================================================
echo    HOSPITAL UNIVERSITARIO NACIONAL DE COLOMBIA (HUN)
echo    Publicador Automatico a GitHub (add + commit + push)
echo =====================================================================
echo.

set "PATH=C:\Program Files\Git\cmd;C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git no esta instalado o no se encuentra en el PATH.
  pause
  exit /b 1
)

if not exist ".git" (
  echo [ERROR] No se encontro la carpeta .git en este directorio.
  pause
  exit /b 1
)

echo [1/3] Verificando estado del repositorio...
git status -s
echo.

:: Verificar si existen cambios pendientes
git status --porcelain | findstr /r "." >nul 2>&1
if errorlevel 1 (
  echo [INFO] No hay cambios pendientes por subir. El repositorio ya esta al dia.
  echo.
  pause
  exit /b 0
)

echo [2/3] Preparando mensaje de confirmacion...
set "MSG="
set /p "MSG=Ingrese una breve descripcion de los cambios (o presione ENTER): "

if "!MSG!"=="" (
  set "MSG=actualizacion de produccion: %DATE% %TIME:~0,5%"
)

echo.
echo Registrando cambios con: "!MSG!"
echo.

git add .
git commit -m "!MSG!"
if errorlevel 1 (
  echo [AVISO] No se requirio crear un nuevo commit.
)

echo.
echo [3/3] Subiendo cambios a GitHub (git push origin main)...
git push origin main
if errorlevel 1 (
  echo.
  echo [ERROR] No se pudieron subir los cambios a GitHub.
  echo Verifica tu conexion a Internet o las credenciales del repositorio.
  echo.
  pause
  exit /b 1
)

echo.
echo =====================================================================
echo    CAMBIOS PUBLICADOS EXITOSAMENTE EN GITHUB
echo.
echo    Siguiente paso en el Servidor (C:\HuniX Particulares):
echo    1. Cierra la ventana de INICIAR_PRODUCCION.bat si esta abierta.
echo    2. Ejecuta: ACTUALIZAR_SERVIDOR.bat
echo    3. Vuelve a ejecutar: INICIAR_PRODUCCION.bat
echo =====================================================================
echo.
pause
