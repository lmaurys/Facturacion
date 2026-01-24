# 🔧 Configuración CORS - Azure Blob Storage para Static Web Apps

## ⚠️ IMPORTANTE: Configurar CORS para tu nueva URL

Una vez que tu aplicación esté desplegada en Azure Static Web Apps, necesitas actualizar la configuración CORS de tu Azure Blob Storage.

## 🌐 URL de tu aplicación
Tu aplicación estará disponible en:
```
https://[nombre-de-tu-static-web-app].azurestaticapps.net
```

## 📋 Pasos para Configurar CORS

### 1. **Ir a Azure Portal**
- Ve a tu **Storage Account** (<account>)
- En el menú lateral, busca **Settings** → **Resource sharing (CORS)**

### 2. **Configurar Blob service CORS**
Agrega una nueva regla con estos valores:

| Campo | Valor |
|-------|-------|
| **Allowed origins** | `https://[tu-app].azurestaticapps.net` |
| **Allowed methods** | `GET, PUT, POST, DELETE, HEAD, OPTIONS` |
| **Allowed headers** | `*` |
| **Exposed headers** | `*` |
| **Max age** | `86400` |

### 3. **Configuración Completa CORS**
Asegúrate de tener AMBAS URLs configuradas:

```
Regla 1:
- Allowed origins: http://localhost:5173
- Methods: GET,PUT,POST,DELETE,HEAD,OPTIONS
- Headers: *
- Exposed headers: *
- Max age: 86400

Regla 2:
- Allowed origins: https://[tu-app].azurestaticapps.net
- Methods: GET,PUT,POST,DELETE,HEAD,OPTIONS  
- Headers: *
- Exposed headers: *
- Max age: 86400
```

## 🔍 Cómo encontrar tu URL exacta

### Opción 1: Azure Portal
1. Ve a **Azure Portal** → **Static Web Apps**
2. Selecciona tu aplicación
3. En **Overview**, copia la **URL**

### Opción 2: Después del Deployment
1. Ve a **GitHub** → **Actions**
2. En el log del deployment, verás la URL final

## 🧪 Verificar Configuración

### 1. **Test de CORS**
Puedes probar si CORS funciona con:
```bash
curl -H "Origin: https://tu-app.azurestaticapps.net" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
    https://<account>.blob.core.windows.net/<container>/<blob>.json
```

### 2. **En la Aplicación**
- Ve a **Gestión Central de Datos**
- Debería mostrar la fecha de última actualización
- Crea un nuevo cliente o curso para probar la sincronización

## ⚡ Configuración Automática (Opcional)

Si quieres automatizar esto, puedes usar Azure CLI:

```bash
# Configurar CORS para tu Static Web App
az storage cors add \
    --methods GET PUT POST DELETE HEAD OPTIONS \
    --origins "https://[tu-app].azurestaticapps.net" \
    --allowed-headers "*" \
    --exposed-headers "*" \
    --max-age 86400 \
    --services b \
    --account-name <account>
```

## 🚨 Troubleshooting

### Error "CORS policy blocked"
- ✅ Verifica que la URL en CORS sea EXACTAMENTE igual a la de tu app
- ✅ Asegúrate de incluir `https://` al inicio
- ✅ No incluyas `/` al final de la URL

### Error "No Access-Control-Allow-Origin"
- ✅ Espera unos minutos después de configurar CORS
- ✅ Refresca la página de tu aplicación
- ✅ Verifica que el SAS Token no haya expirado

---

💡 **Tip**: Mantén ambas configuraciones (localhost Y static web app) para poder desarrollar localmente y tener la app en producción. 