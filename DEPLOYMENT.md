# 🚀 Deployment Guide - Azure Static Web Apps

## 📋 Pre-requisitos
- ✅ Azure Static Web App creada
- ✅ Repositorio de GitHub
- ✅ Token de deployment configurado

## 🔧 Configuración Realizada

### 1. **GitHub Actions Workflow**
- Archivo: `.github/workflows/azure-static-web-apps.yml`
- ✅ Configurado para build automático con Vite
- ✅ Deploy automático en push a branch `main`
- ✅ Token de deployment incluido

### 2. **Configuración de Azure Static Web Apps**
- Archivo: `staticwebapp.config.json`
- ✅ Routing para SPA (Single Page Application)
- ✅ Fallback a `index.html` para rutas no encontradas
- ✅ Configuración de cache y headers

## 🚀 Pasos para Deployment

### Paso 1: Commit y Push
```bash
git add .
git commit -m "Configure Azure Static Web Apps deployment"
git push origin main
```

### Paso 2: Verificar Deployment
1. Ve a **GitHub** → **Actions** → Verifica que el workflow esté ejecutándose
2. Ve a **Azure Portal** → **Tu Static Web App** → **GitHub Actions** para ver el progreso

### Paso 3: Acceder a tu App
- Tu aplicación estará disponible en: `https://[nombre-de-tu-app].azurestaticapps.net`

## 🔍 Verificaciones Post-Deployment

### ✅ Funcionalidades a Probar:
1. **Navegación entre páginas** (Clientes, Cursos, Facturas, etc.)
2. **Creación de datos** (Nuevos clientes, cursos)
3. **Sincronización con Azure Blob Storage**
4. **Generación de facturas PDF**
5. **Análisis de facturación**

### 🔧 Configuración de Azure Blob Storage
Asegúrate de que tu Azure Blob Storage esté configurado con:
- ✅ CORS habilitado para tu dominio de Azure Static Web Apps
- ✅ SAS Token válido y con permisos adecuados

## 🛠️ Solución de Problemas Comunes

### Error de Build
- Verifica que todas las dependencias estén en `package.json`
- Asegúrate que el comando `npm run build` funcione localmente

### Error de Routing
- Verifica que `staticwebapp.config.json` esté en la raíz del proyecto
- Las rutas SPA deben redirigir a `index.html`

### Error de CORS
```javascript
// En Azure Portal → Storage Account → CORS
// Agregar tu dominio: https://[tu-app].azurestaticapps.net
```

### Error de SAS Token
- Verifica que el token no haya expirado
- Asegúrate que tenga permisos de lectura/escritura

## 📁 Estructura de Archivos para Deployment

```
proyecto/
├── .github/workflows/
│   └── azure-static-web-apps.yml     # ✅ GitHub Actions
├── public/                           # Assets estáticos
├── src/                             # Código fuente
├── staticwebapp.config.json         # ✅ Config Azure SWA
├── package.json                     # ✅ Dependencies
└── vite.config.ts                   # ✅ Vite config
```

## 🎯 Próximos Pasos

1. **Hacer commit y push** de estos archivos
2. **Verificar el deployment** en GitHub Actions
3. **Probar la aplicación** en la URL de Azure
4. **Configurar dominio personalizado** (opcional)

---

🎉 **¡Tu aplicación de facturación estará en línea en pocos minutos!** 