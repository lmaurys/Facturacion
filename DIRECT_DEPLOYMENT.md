# 🚀 Deployment Directo - Azure Static Web Apps (Sin GitHub)

## 📋 Pre-requisitos
- ✅ Azure CLI instalado
- ✅ Node.js y npm instalados
- ✅ Azure Static Web App creada
- ✅ Token de deployment

## 🛠️ Instalación de Herramientas

### 1. **Instalar Azure CLI** (si no lo tienes)

**Windows:**
```bash
winget install Microsoft.AzureCLI
```

**macOS:**
```bash
brew install azure-cli
```

**Linux:**
```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

### 2. **Instalar Azure Static Web Apps CLI**
```bash
npm install -g @azure/static-web-apps-cli
```

### 3. **Login a Azure**
```bash
az login
```

## 🏗️ Build y Deployment

### Paso 1: **Build Local**
```bash
# Instalar dependencias
npm install

# Crear build de producción
npm run build
```

### Paso 2: **Deployment Directo**
```bash
# Opción A: Usando Static Web Apps CLI
swa deploy ./dist --deployment-token $SWA_DEPLOYMENT_TOKEN --env production

# Opción B: Usando Azure CLI (si prefieres)
az staticwebapp deploy \
  --name [nombre-de-tu-static-web-app] \
  --resource-group [tu-resource-group] \
  --source ./dist
```

## 📜 Script de Deployment Automático

Crea un script para automatizar el proceso:

### **Windows (deploy.bat)**
```batch
@echo off
echo 🏗️ Building application...
npm run build

echo 🚀 Deploying to Azure Static Web Apps...
swa deploy ./dist --deployment-token $SWA_DEPLOYMENT_TOKEN --env production

echo ✅ Deployment completed!
echo 🌐 Your app should be available at: https://[tu-app].azurestaticapps.net
pause
```

### **macOS/Linux (deploy.sh)**
```bash
#!/bin/bash
echo "🏗️ Building application..."
npm run build

echo "🚀 Deploying to Azure Static Web Apps..."
swa deploy ./dist --deployment-token $SWA_DEPLOYMENT_TOKEN

echo "✅ Deployment completed!"
echo "🌐 Your app should be available at: https://[tu-app].azurestaticapps.net"
```

## ⚡ Deployment en Un Solo Comando

### **Opción 1: NPM Script**
Agrega esto a tu `package.json`:
```json
{
  "scripts": {
    "deploy": "npm run build && swa deploy ./dist --deployment-token $SWA_DEPLOYMENT_TOKEN --env production"
  }
}
```

Luego ejecuta:
```bash
npm run deploy
```

### **Opción 2: Script Personalizado**
```bash
# Crear y ejecutar script de deployment
chmod +x deploy.sh
./deploy.sh
```

## 🔧 Configuración Adicional

### **Archivo .env para desarrollo**
Crea un archivo `.env.local`:
```env
VITE_AZURE_STATIC_WEB_APP_URL=https://[tu-app].azurestaticapps.net
```

### **Verificar Build Local**
Antes de hacer deployment, prueba localmente:
```bash
# Build
npm run build

# Preview local del build
npm run preview
```

## 🧪 Proceso de Deployment Paso a Paso

### 1. **Preparación**
```bash
# Asegúrate de estar en el directorio del proyecto
cd /path/to/tu-proyecto

# Instalar dependencias
npm install
```

### 2. **Build**
```bash
# Crear build optimizado
npm run build

# Verificar que se creó la carpeta 'dist'
ls -la dist/
```

### 3. **Deploy**
```bash
# Deployment directo
swa deploy ./dist --deployment-token $SWA_DEPLOYMENT_TOKEN --env production
```

### 4. **Verificación**
- El comando te dará la URL de tu aplicación
- Verifica que todas las páginas funcionen
- Prueba la sincronización con Azure Blob Storage

## 🚨 Troubleshooting

### Error: "swa command not found"
```bash
# Reinstalar Azure Static Web Apps CLI
npm uninstall -g @azure/static-web-apps-cli
npm install -g @azure/static-web-apps-cli
```

### Error: "deployment token invalid"
- Verifica que el token sea correcto
- Asegúrate de que no haya espacios o caracteres extra

### Error: "build failed"
```bash
# Limpiar node_modules y reinstalar
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📈 Actualizaciones Futuras

Para actualizar tu aplicación:
```bash
# 1. Hacer cambios en tu código
# 2. Build y deploy
npm run build
swa deploy ./dist --deployment-token [tu-token] --env production
```

---

🎯 **¡Listo para desplegar directamente desde tu máquina local!** 