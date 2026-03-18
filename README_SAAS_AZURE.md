# Facturacion SaaS en Azure

Esta versión quedó preparada para operar como SaaS multi-tenant:

- Autenticación: Microsoft Entra ID
- Persistencia operativa: Azure SQL Database
- Aislamiento: todas las entidades se guardan por `tenantId`
- Seed inicial: `https://cmfiles.blob.core.windows.net/capacitaciones/sistema_gestion_completo.json`

## 1. Crear la base Azure SQL

Para un arranque pequeño y económico puedes usar cualquiera de estas opciones:

- Azure SQL Database `Basic`
- Azure SQL Database `General Purpose - Serverless` con el mínimo de vCores

Aplica el esquema:

```bash
sqlcmd -S <servidor>.database.windows.net -d <base> -U <usuario> -P <password> -i server/sql/001_init.sql
```

## 2. Configurar Entra ID

Registra una aplicación en Entra ID y configura:

- SPA redirect URI: `http://localhost:5173`
- Scope expuesto para el API: `access_as_user`
- Audience sugerido: `api://<CLIENT_ID>`

## 3. Variables de entorno

Copia `.env.example` a `.env` y completa:

- `AZURE_SQL_CONNECTION_STRING`
- `ENTRA_TENANT_ID`
- `ENTRA_CLIENT_ID`
- `ENTRA_AUDIENCE`

Para producción en Azure App Service usa estas variables del servidor y evita depender de `VITE_*`:

- `AZURE_SQL_CONNECTION_STRING`
- `ENTRA_TENANT_ID`
- `ENTRA_CLIENT_ID`
- `ENTRA_AUDIENCE`
- `ENTRA_ALLOW_ANY_TENANT`
- `APP_PUBLIC_ORIGIN` opcional si quieres fijar un origen distinto al hostname público

Las variables `VITE_*` quedan solo como respaldo para desarrollo local. En producción, la SPA carga la configuración viva desde `GET /api/public-config`, así que un redeploy del frontend ya no debería romper Entra ID por haber compilado sin secretos o IDs.

## 4. Sembrar el primer tenant

El tenant inicial queda parametrizado por:

- `DEFAULT_TENANT_ID=tenant-capacitaciones`
- `DEFAULT_TENANT_NAME=Capacitaciones`
- `DEFAULT_TENANT_SLUG=capacitaciones`

Para cargar los datos del JSON actual:

```bash
npm run seed:first-tenant
```

Si `AUTO_ASSIGN_FIRST_USER=true`, el primer usuario autenticado quedará asignado como `owner` del tenant inicial.

## 5. Ejecutar localmente

```bash
npm install
npm run dev
```

Esto levanta:

- Frontend Vite en `http://localhost:5173`
- API Express en `http://localhost:8787`

## 6. Build de producción

```bash
npm run build
```

La build compila:

- frontend en `dist/`
- backend en `server/dist/`

## 7. Smoke test antes de una demo

Después de publicar, valida el sitio real con:

```bash
npm run smoke:saas -- https://cmfactinstructsaas260315.azurewebsites.net
```

Ese chequeo confirma:

- `GET /api/public-config` responde JSON y no HTML
- la configuración de Entra viene con `clientId`, `tenantId` y `apiScope`
- `Cache-Control` de esa ruta queda en `no-store`
- `GET /api/health` responde con auth activa
