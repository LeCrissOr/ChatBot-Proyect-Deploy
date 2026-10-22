@echo off
title HUN - Abrir Puertos en Firewall de Windows
color 0b

echo =====================================================================
echo    Abriendo puertos TCP 3001 y 5173 en Windows Defender Firewall
echo    (Debe ejecutarse como Administrador)
echo =====================================================================
echo.

netsh advfirewall firewall delete rule name="HUN ChatBot Server (TCP 3001)" >nul 2>&1
netsh advfirewall firewall add rule name="HUN ChatBot Server (TCP 3001)" dir=in action=allow protocol=TCP localport=3001
if errorlevel 1 (
  echo [ERROR] No se pudieron crear las reglas. Haz clic derecho sobre este archivo y elige "Ejecutar como administrador".
  pause
  exit /b 1
)

netsh advfirewall firewall delete rule name="HUN ChatBot Dev Dashboard (TCP 5173)" >nul 2>&1
netsh advfirewall firewall add rule name="HUN ChatBot Dev Dashboard (TCP 5173)" dir=in action=allow protocol=TCP localport=5173

echo.
echo [OK] Puertos 3001 y 5173 habilitados exitosamente en el Firewall de Windows.
echo      Cualquier equipo en la red del HUN ya puede entrar a http://IP_DEL_SERVIDOR:3001
echo.
pause
