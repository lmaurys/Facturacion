# 🚀 Deployment Rápido - Azure Static Web Apps

## ⚡ Opciones de Deployment Directo

### **Opción 1: Script Automatizado (Recomendado)**

#### **Windows:**
```cmd
deploy.bat
```

#### **macOS/Linux:**
```bash
./deploy.sh
```

### **Opción 2: NPM Command**
```bash
# Instalar Azure SWA CLI primero (solo la primera vez)
npm install -g @azure/static-web-apps-cli

# Deployment directo
npm run deploy
```

### **Opción 3: Comandos Manuales**
```bash
# 1. Build
npm run build

# 2. Deploy
swa deploy ./dist --deployment-token $SWA_DEPLOYMENT_TOKEN --env production
```

## 🎯 Pasos Rápidos

1. **Abre tu terminal** en el directorio del proyecto
2. **Ejecuta uno de los comandos** de arriba
3. **Espera** unos minutos (2-5 min)
4. **¡Tu app estará en línea!**

## ⚠️ Importante Después del Deployment

### **Configura CORS para Azure Blob Storage:**
1. Ve a **Azure Portal** → **Storage Account (<account>)** → **CORS**
2. Agrega tu nueva URL: `https://[tu-app].azurestaticapps.net`
3. **Sin esto, la sincronización no funcionará**

## 🔧 Si hay Problemas

### **Error: "swa command not found"**
```bash
npm install -g @azure/static-web-apps-cli
```

### **Error de build**
```bash
npm install
npm run build
```

### **Error de token**
- Verifica que tu Azure Static Web App esté activa
- El token debería funcionar tal como está

---

🎉 **¡Es así de simple! Tu aplicación estará en línea en minutos.** 