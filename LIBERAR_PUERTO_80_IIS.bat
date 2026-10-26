@echo off
title HUN - Liberar Puerto 80 de IIS
color 0b

echo =====================================================================
echo    HOSPITAL UNIVERSITARIO NACIONAL DE COLOMBIA (HUN)
echo    Liberar Puerto 80 de IIS (Internet Information Services)
echo    (Debe ejecutarse como Administrador)
echo =====================================================================
echo.

echo [1/2] Deteniendo el sitio por defecto de IIS en el puerto 80...
if exist "%windir%\system32\inetsrv\appcmd.exe" (
  "%windir%\system32\inetsrv\appcmd.exe" stop site "Default Web Site" >nul 2>&1
)

echo [2/2] Deteniendo el servicio W3SVC de IIS para liberar el puerto 80...
net stop w3svc >nul 2>&1
sc config w3svc start= demand >nul 2>&1

echo.
echo =====================================================================
echo    PUERTO 80 LIBERADO EXITOSAMENTE
echo.
echo    La pantalla azul de IIS ha sido desactivada.
echo    Ahora el puerto 80 redirige automaticamente a tu Dashboard HUN.
echo.
echo    Prueba abriendo en Chrome:
echo    http://huncontigoparticulares.hun.edu.co
echo.
echo    (Si persiste la pantalla azul en el navegador, presiona Ctrl + F5)
echo =====================================================================
echo.
pause
