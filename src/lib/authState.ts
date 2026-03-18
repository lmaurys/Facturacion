const TENANT_STORAGE_KEY = 'facturacion.currentTenantId';

let accessTokenResolver: (() => Promise<string | null>) | null = null;

export const registerAccessTokenResolver = (
  resolver: (() => Promise<string | null>) | null,
): void => {
  accessTokenResolver = resolver;
};

export const getAccessToken = async (): Promise<string | null> => {
  return accessTokenResolver ? accessTokenResolver() : null;
};

export const getSelectedTenantId = (): string => {
  return localStorage.getItem(TENANT_STORAGE_KEY) || '';
};

export const setSelectedTenantId = (tenantId: string): void => {
  if (!tenantId) {
    localStorage.removeItem(TENANT_STORAGE_KEY);
    return;
  }

  localStorage.setItem(TENANT_STORAGE_KEY, tenantId);
};
