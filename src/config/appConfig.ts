const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const unique = <T,>(values: T[]): T[] => Array.from(new Set(values));

export type RuntimeAppConfig = {
  apiBaseUrl: string;
  entra: {
    clientId: string;
    tenantId: string;
    redirectUri: string;
    apiScope: string;
  };
};

const buildEnvConfig = (): RuntimeAppConfig => ({
  apiBaseUrl: trimTrailingSlash(import.meta.env.VITE_API_BASE_URL || ''),
  entra: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID || '',
    tenantId: import.meta.env.VITE_ENTRA_AUTHORITY_TENANT || import.meta.env.VITE_ENTRA_TENANT_ID || '',
    redirectUri: import.meta.env.VITE_ENTRA_REDIRECT_URI || window.location.origin,
    apiScope:
      import.meta.env.VITE_ENTRA_API_SCOPE ||
      (import.meta.env.VITE_ENTRA_CLIENT_ID
        ? `api://${import.meta.env.VITE_ENTRA_CLIENT_ID}/access_as_user`
        : ''),
  },
});

export const appConfig: RuntimeAppConfig = buildEnvConfig();

const applyConfig = (nextConfig: Partial<RuntimeAppConfig>): void => {
  if (nextConfig.apiBaseUrl !== undefined) {
    appConfig.apiBaseUrl = trimTrailingSlash(nextConfig.apiBaseUrl);
  }

  if (nextConfig.entra) {
    appConfig.entra = {
      ...appConfig.entra,
      ...nextConfig.entra,
      redirectUri: nextConfig.entra.redirectUri || appConfig.entra.redirectUri || window.location.origin,
    };
  }
};

export const loadRuntimeAppConfig = async (): Promise<void> => {
  const fallbackBaseUrl = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL || '');
  const configUrls = unique(
    [
      '/api/public-config',
      '/runtime-config.json',
      fallbackBaseUrl ? `${fallbackBaseUrl}/api/public-config` : '',
      fallbackBaseUrl ? `${fallbackBaseUrl}/runtime-config.json` : '',
    ].filter(Boolean),
  );

  for (const configUrl of configUrls) {
    try {
      const response = await fetch(configUrl, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        continue;
      }

      const runtimeConfig = (await response.json()) as Partial<RuntimeAppConfig>;
      applyConfig(runtimeConfig);
      return;
    } catch (error) {
      console.warn(`No se pudo cargar configuración en runtime desde ${configUrl}.`, error);
    }
  }
};

export const isEntraConfigured = (): boolean => {
  return Boolean(appConfig.entra.clientId && appConfig.entra.tenantId && appConfig.entra.apiScope);
};
