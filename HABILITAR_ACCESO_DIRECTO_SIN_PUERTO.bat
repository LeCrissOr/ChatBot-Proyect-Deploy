@echo off
title HUN - Habilitar Acceso Directo por Puerto 80 (Sin escribir :3001)
color 0b

echo =====================================================================
echo    HOSPITAL UNIVERSITARIO NACIONAL DE COLOMBIA (HUN)
echo    Configuracion de Redireccion Puerto 80 -^> Puerto 3001
echo    (Debe ejecutarse como Administrador)
echo =====================================================================
echo.

:: 1. Habilitar regla de Firewall para puerto 80 (HTTP)
echo [1/2] Habilitando puerto 80 en Firewall de Windows...
netsh advfirewall firewall delete rule name="HUN ChatBot HTTP (TCP 80)" >nul 2>&1
netsh advfirewall firewall add rule name="HUN ChatBot HTTP (TCP 80)" dir=in action=allow protocol=TCP localport=80
if errorlevel 1 (
  echo.
  echo [ERROR] No se pudo modificar la configuracion de red.
  echo Haz clic derecho sobre este archivo y selecciona "Ejecutar como administrador".
  echo.
  pause
  exit /b 1
)

:: 2. Configurar portproxy nativo de Windows (redirige el puerto 80 al 3001)
echo [2/2] Configurando reenvio automatico del puerto 80 al 3001...
netsh interface portproxy delete v4tov4 listenport=80 listenaddress=0.0.0.0 >nul 2>&1
netsh interface portproxy add v4tov4 listenport=80 listenaddress=0.0.0.0 connectport=3001 connectaddress=127.0.0.1

echo.
echo =====================================================================
echo    CONFIGURACION COMPLETADA EXITOSAMENTE
echo.
echo    Ahora puedes ingresar directamente desde cualquier navegador a:
echo    http://huncontigoparticulares.hun.edu.co
echo.
echo    (Tambien continuara funcionando con http://...:3001)
echo =====================================================================
echo.
pause
