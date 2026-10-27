@echo off
chcp 65001 >nul
title LIMPIEZA DE DATOS DE PACIENTES - HUN CHATBOT
color 0C

echo =====================================================================
echo    HOSPITAL UNIVERSITARIO NACIONAL DE COLOMBIA (HUN)
echo    Limpieza de Datos de Pacientes y Agendamientos Locales (PostgreSQL)
echo =====================================================================
echo.
echo  ADVERTENCIA: Esta accion eliminara:
echo   - Citas agendadas locales
echo   - Fichas y contactos de pacientes registrados
echo   - Conversaciones y mensajes de WhatsApp del panel
echo   - Tickets de soporte y cotizaciones
echo.
echo  NOTA: NO afecta Hosvital ni los usuarios/configuraciones del sistema.
echo.
set /p CONFIRM="¿Estas seguro de realizar la limpieza? (S/N): "
if /i not "%CONFIRM%"=="S" (
  echo Operacion cancelada.
  pause
  exit /b 0
)

echo.
echo [1/1] Ejecutando limpieza en PostgreSQL...
cd /d "%~dp0backend"
node scripts/cleanPatientData.js
if errorlevel 1 (
  echo [ERROR] No se pudo completar la limpieza.
  pause
  exit /b 1
)

echo.
echo =====================================================================
echo    LIMPIEZA COMPLETADA CON EXITO
echo =====================================================================
echo.
pause
