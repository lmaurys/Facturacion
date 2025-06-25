# Sincronización con Azure Blob Storage

Este documento explica cómo funciona la sincronización automática con Azure Blob Storage implementada en el sistema de facturación.

## Configuración

### URL del Blob Storage
```
https://cmfiles.blob.core.windows.net/capacitaciones/sistema_gestion_completo.json
```

### Clave de Acceso
```
SHs3w3t+8kyVPuvCizpptpkihCaJFDzPsynP9o7xjsBlCssK0ez+GbTdepdMGJIGUBtQntBbrQMWiHfRkyBl5Q==
```

## Funcionalidades Implementadas

### 1. Sincronización Automática
- **Frecuencia**: Cada 15 minutos
- **Inicio**: Automático al cargar la aplicación
- **Funcionamiento**: Sube los datos locales a Azure Blob Storage

### 2. Sincronización Manual
Accesible desde la sección "Gestión Central de Datos":

#### Subir a Azure
- Envía los datos locales (cursos, clientes, facturas) a Azure Blob Storage
- Compara versiones para evitar sobrescribir datos más recientes

#### Descargar de Azure
- Descarga los datos desde Azure Blob Storage
- Reemplaza los datos locales con los datos del servidor
- Recarga la aplicación automáticamente

#### Forzar Sincronización
- Sobrescribe los datos en Azure sin comparar versiones
- Útil para resolver conflictos de sincronización

### 3. Métodos de Autenticación
El sistema implementa múltiples métodos de autenticación para garantizar compatibilidad:

1. **SharedKey Authentication** (método principal)
2. **Acceso directo** (si el blob es público)
3. **SAS Token style** (clave como parámetro URL)
4. **POST method** (como fallback)

## Estructura de Datos Sincronizados

```json
{
  "courses": [...],
  "clients": [...],
  "invoices": [...],
  "exportDate": "2025-01-XX...",
  "version": 2
}
```

## Archivos Implementados

### `/src/utils/azureBlobSync.ts`
- Funciones de comunicación con Azure Blob Storage
- Manejo de errores y métodos alternativos
- Lógica de sincronización inteligente

### `/src/utils/centralizedStorage.ts`
- Funciones principales de sincronización
- Exportación e importación de datos
- Integración con IndexedDB local

### `/src/utils/storage.ts`
- Funciones de alto nivel para la aplicación
- Inicialización de sincronización automática
- Wrappers para facilitar el uso

### `/src/components/DataManagement.tsx`
- Interfaz de usuario para sincronización manual
- Botones y estados de carga
- Mensajes de éxito y error

## Uso

### Sincronización Automática
La sincronización se inicia automáticamente al cargar la aplicación. No requiere intervención del usuario.

### Sincronización Manual
1. Ve a la sección "Gestión Central de Datos"
2. Usa los botones en la sección "Sincronización con Azure Blob Storage"
3. Espera la confirmación de éxito o error

### Resolución de Problemas

#### Si la sincronización falla:
1. Verifica la conexión a internet
2. Comprueba que la URL de Azure sea correcta
3. Verifica que la clave de acceso sea válida
4. Usa "Forzar Sincronización" si hay conflictos

#### Si los datos no se actualizan:
1. Usa "Descargar de Azure" para obtener la versión más reciente
2. Verifica que la fecha de exportación sea correcta
3. Comprueba la consola del navegador para errores

## Seguridad

- La clave de acceso está almacenada en el código fuente
- Se recomienda usar variables de entorno en producción
- Los datos se transmiten usando HTTPS
- La autenticación usa métodos estándar de Azure

## Logging

El sistema registra todas las operaciones en la consola del navegador:
- ✅ Sincronización exitosa
- ⚠️ Advertencias de sincronización
- ❌ Errores de sincronización

## Formato de Logs

```
Iniciando exportación y sincronización con Azure...
✅ Sincronización automática exitosa: Datos sincronizados exitosamente con Azure Blob Storage
```

## Consideraciones Técnicas

### Manejo de Conflictos
- El sistema compara fechas de exportación y versiones
- Los datos más recientes tienen prioridad
- Se puede forzar la sincronización si es necesario

### Fallbacks
- Si Azure no está disponible, los datos se mantienen localmente
- IndexedDB como almacenamiento principal
- localStorage como respaldo adicional

### Performance
- Sincronización inteligente (solo cuando hay cambios)
- Compresión JSON para reducir tamaño
- Timeouts configurables para evitar bloqueos 