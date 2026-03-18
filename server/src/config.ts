import dotenv from 'dotenv';

dotenv.config();

const asBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

export const config = {
  port: Number(process.env.PORT || 8787),
  azureSqlConnectionString: process.env.AZURE_SQL_CONNECTION_STRING || '',
  entra: {
    tenantId: process.env.ENTRA_TENANT_ID || '',
    homeTenantId: process.env.ENTRA_HOME_TENANT_ID || process.env.ENTRA_TENANT_ID || '',
    clientId: process.env.ENTRA_CLIENT_ID || '',
    audience: process.env.ENTRA_AUDIENCE || '',
    allowAnyTenant: asBoolean(process.env.ENTRA_ALLOW_ANY_TENANT, false),
  },
  defaultTenant: {
    tenantId: process.env.DEFAULT_TENANT_ID || 'tenant-capacitaciones',
    name: process.env.DEFAULT_TENANT_NAME || 'Capacitaciones',
    slug: process.env.DEFAULT_TENANT_SLUG || 'capacitaciones',
  },
  autoAssignFirstUser: asBoolean(process.env.AUTO_ASSIGN_FIRST_USER, true),
  seedSourceUrl:
    process.env.SEED_SOURCE_URL ||
    'https://cmfiles.blob.core.windows.net/capacitaciones/sistema_gestion_completo.json',
};

export const isAuthConfigured = (): boolean =>
  Boolean(config.azureSqlConnectionString && config.entra.tenantId && config.entra.clientId);
