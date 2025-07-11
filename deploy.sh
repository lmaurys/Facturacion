#!/bin/bash

echo "🚀 === DEPLOYMENT DIRECTO A AZURE STATIC WEB APPS ==="
echo ""

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Token de deployment
DEPLOYMENT_TOKEN="b65c4dbbb627fc20e437229ddb1012b09aed5fc8ee7a3d7cb821afc91f3b1bd002-d5eb9306-d54c-477e-990b-b1fb3eca3019010182103f262410"

echo -e "${BLUE}📦 Paso 1: Instalando dependencias...${NC}"
if npm install; then
    echo -e "${GREEN}✅ Dependencias instaladas correctamente${NC}"
else
    echo -e "${RED}❌ Error instalando dependencias${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🏗️ Paso 2: Building aplicación...${NC}"
if npm run build; then
    echo -e "${GREEN}✅ Build completado correctamente${NC}"
else
    echo -e "${RED}❌ Error en el build${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🔍 Paso 3: Verificando Azure Static Web Apps CLI...${NC}"
if ! command -v swa &> /dev/null; then
    echo -e "${YELLOW}⚠️ Azure Static Web Apps CLI no encontrado. Instalando...${NC}"
    if npm install -g @azure/static-web-apps-cli; then
        echo -e "${GREEN}✅ Azure SWA CLI instalado correctamente${NC}"
    else
        echo -e "${RED}❌ Error instalando Azure SWA CLI${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Azure SWA CLI ya está instalado${NC}"
fi

echo ""
echo -e "${BLUE}🚀 Paso 4: Desplegando a Azure Static Web Apps...${NC}"
echo -e "${YELLOW}Esto puede tomar unos minutos...${NC}"

if swa deploy ./dist --deployment-token $DEPLOYMENT_TOKEN --env production; then
    echo ""
    echo -e "${GREEN}🎉 ¡DEPLOYMENT COMPLETADO EXITOSAMENTE!${NC}"
    echo ""
    echo -e "${BLUE}🌐 Tu aplicación debería estar disponible en pocos minutos en:${NC}"
    echo -e "${GREEN}https://[tu-app].azurestaticapps.net${NC}"
    echo ""
    echo -e "${YELLOW}📋 Próximos pasos:${NC}"
    echo "1. Verifica la URL en Azure Portal"
    echo "2. Configura CORS en Azure Blob Storage con tu nueva URL"
    echo "3. Prueba todas las funcionalidades de la aplicación"
else
    echo -e "${RED}❌ Error en el deployment${NC}"
    echo ""
    echo -e "${YELLOW}💡 Posibles soluciones:${NC}"
    echo "1. Verifica que el deployment token sea correcto"
    echo "2. Asegúrate de tener conexión a internet"
    echo "3. Intenta ejecutar el comando manualmente:"
    echo "   swa deploy ./dist --deployment-token $DEPLOYMENT_TOKEN --env production"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Script completado${NC}" 