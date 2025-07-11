@echo off
setlocal

echo 🚀 === DEPLOYMENT DIRECTO A AZURE STATIC WEB APPS ===
echo.

REM Token de deployment
set DEPLOYMENT_TOKEN=b65c4dbbb627fc20e437229ddb1012b09aed5fc8ee7a3d7cb821afc91f3b1bd002-d5eb9306-d54c-477e-990b-b1fb3eca3019010182103f262410

echo 📦 Paso 1: Instalando dependencias...
call npm install
if %ERRORLEVEL% neq 0 (
    echo ❌ Error instalando dependencias
    pause
    exit /b 1
)
echo ✅ Dependencias instaladas correctamente
echo.

echo 🏗️ Paso 2: Building aplicación...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ❌ Error en el build
    pause
    exit /b 1
)
echo ✅ Build completado correctamente
echo.

echo 🔍 Paso 3: Verificando Azure Static Web Apps CLI...
where swa >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ⚠️ Azure Static Web Apps CLI no encontrado. Instalando...
    call npm install -g @azure/static-web-apps-cli
    if %ERRORLEVEL% neq 0 (
        echo ❌ Error instalando Azure SWA CLI
        pause
        exit /b 1
    )
    echo ✅ Azure SWA CLI instalado correctamente
) else (
    echo ✅ Azure SWA CLI ya está instalado
)
echo.

echo 🚀 Paso 4: Desplegando a Azure Static Web Apps...
echo Esto puede tomar unos minutos...
echo.

call swa deploy ./dist --deployment-token %DEPLOYMENT_TOKEN% --env production
if %ERRORLEVEL% neq 0 (
    echo.
    echo ❌ Error en el deployment
    echo.
    echo 💡 Posibles soluciones:
    echo 1. Verifica que el deployment token sea correcto
    echo 2. Asegúrate de tener conexión a internet
    echo 3. Intenta ejecutar el comando manualmente:
    echo    swa deploy ./dist --deployment-token %DEPLOYMENT_TOKEN% --env production
    echo.
    pause
    exit /b 1
)

echo.
echo 🎉 ¡DEPLOYMENT COMPLETADO EXITOSAMENTE!
echo.
echo 🌐 Tu aplicación debería estar disponible en pocos minutos en:
echo https://[tu-app].azurestaticapps.net
echo.
echo 📋 Próximos pasos:
echo 1. Verifica la URL en Azure Portal
echo 2. Configura CORS en Azure Blob Storage con tu nueva URL
echo 3. Prueba todas las funcionalidades de la aplicación
echo.
echo ✅ Script completado

pause 