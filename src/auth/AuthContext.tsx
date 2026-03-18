import React from 'react';
import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';
import { appConfig, isEntraConfigured } from '../config/appConfig';
import { apiGet } from '../lib/apiClient';
import { registerAccessTokenResolver, getSelectedTenantId, setSelectedTenantId } from '../lib/authState';
import type { SessionResponse, TenantMembership } from '../types';

type AuthStatus = 'checking' | 'signed-out' | 'signed-in' | 'misconfigured' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  user: SessionResponse['user'] | null;
  memberships: TenantMembership[];
  currentTenant: TenantMembership | null;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  switchTenant: (tenantId: string) => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

let msalInstance: PublicClientApplication | null = null;
const msalTemporaryKeys = ['request.origin', 'urlHash', 'request.params', 'code.verifier', 'interaction.status', 'request.native'];

const hasRedirectResponseInUrl = (): boolean => {
  const hash = window.location.hash;
  return hash.includes('code=') || hash.includes('error=') || hash.includes('id_token=');
};

const getErrorCode = (error: unknown): string => {
  if (typeof error === 'object' && error && 'errorCode' in error) {
    return String((error as { errorCode?: unknown }).errorCode || '');
  }

  if (typeof error === 'object' && error && 'code' in error) {
    return String((error as { code?: unknown }).code || '');
  }

  return '';
};

const isIgnorableRedirectHandlingError = (error: unknown): boolean => {
  return getErrorCode(error) === 'no_token_request_cache_error';
};

const formatAuthError = (error: unknown): string => {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '').trim();
    if (message) {
      return `No se pudo iniciar la autenticación con Entra ID. ${message}`;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return `No se pudo iniciar la autenticación con Entra ID. ${error.message.trim()}`;
  }

  return 'No se pudo iniciar la autenticación con Entra ID.';
};

const clearStaleMsalState = (): void => {
  if (hasRedirectResponseInUrl()) {
    return;
  }

  msalTemporaryKeys.forEach((key) => {
    const candidateKeys = [
      `msal.${key}`,
      appConfig.entra.clientId ? `msal.${appConfig.entra.clientId}.${key}` : '',
    ].filter(Boolean);

    candidateKeys.forEach((candidateKey) => {
      window.localStorage.removeItem(candidateKey);
      window.sessionStorage.removeItem(candidateKey);
    });
  });
};

const getMsalInstance = (): PublicClientApplication => {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication({
      auth: {
        clientId: appConfig.entra.clientId,
        authority: `https://login.microsoftonline.com/${appConfig.entra.tenantId}`,
        redirectUri: appConfig.entra.redirectUri,
      },
      cache: {
        cacheLocation: 'localStorage',
      },
    });
  }

  return msalInstance;
};

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [status, setStatus] = React.useState<AuthStatus>('checking');
  const [user, setUser] = React.useState<SessionResponse['user'] | null>(null);
  const [memberships, setMemberships] = React.useState<TenantMembership[]>([]);
  const [currentTenant, setCurrentTenant] = React.useState<TenantMembership | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const accountRef = React.useRef<AccountInfo | null>(null);

  const acquireAccessToken = React.useCallback(async (): Promise<string | null> => {
    if (!isEntraConfigured()) {
      return null;
    }

    const instance = getMsalInstance();
    const account = accountRef.current || instance.getAllAccounts()[0] || null;
    if (!account) {
      return null;
    }

    try {
      const result = await instance.acquireTokenSilent({
        account,
        scopes: [appConfig.entra.apiScope],
      });
      return result.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        await instance.acquireTokenRedirect({
          account,
          scopes: [appConfig.entra.apiScope],
          redirectUri: appConfig.entra.redirectUri,
        });
        return null;
      }

      throw error;
    }
  }, []);

  const applySession = React.useCallback((session: SessionResponse) => {
    setUser(session.user);
    setMemberships(session.memberships);
    const persistedTenantId = getSelectedTenantId();
    const resolvedTenant =
      session.memberships.find((membership) => membership.tenantId === persistedTenantId) ||
      session.memberships.find((membership) => membership.tenantId === session.defaultTenantId) ||
      session.memberships[0] ||
      null;

    setCurrentTenant(resolvedTenant);
    setSelectedTenantId(resolvedTenant?.tenantId || '');
    setStatus('signed-in');
    setError(null);
  }, []);

  const refreshSession = React.useCallback(async () => {
    if (!isEntraConfigured()) {
      setStatus('misconfigured');
      setError('Faltan variables de Entra ID en el frontend.');
      return;
    }

    const accounts = getMsalInstance().getAllAccounts();
    if (!accounts.length) {
      setStatus('signed-out');
      setUser(null);
      setMemberships([]);
      setCurrentTenant(null);
      return;
    }

    accountRef.current = accounts[0];
    const session = await apiGet<SessionResponse>('/api/me');
    applySession(session);
  }, [applySession]);

  React.useEffect(() => {
    registerAccessTokenResolver(acquireAccessToken);

    const initialize = async () => {
      if (!isEntraConfigured()) {
        setStatus('misconfigured');
        setError('Configura Entra ID para habilitar el acceso SaaS.');
        return;
      }

      try {
        clearStaleMsalState();
        const instance = getMsalInstance();
        await instance.initialize();

        try {
          const redirectResult = await instance.handleRedirectPromise();
          if (redirectResult?.account) {
            accountRef.current = redirectResult.account;
          }
        } catch (error) {
          if (!isIgnorableRedirectHandlingError(error)) {
            throw error;
          }

          console.warn('No había una respuesta redirect pendiente de procesar:', error);
        }

        accountRef.current = accountRef.current || instance.getAllAccounts()[0] || null;

        if (!accountRef.current) {
          setStatus('signed-out');
          return;
        }

        await refreshSession();
      } catch (error) {
        console.error('Error inicializando la autenticación:', error);
        setStatus('error');
        setError(formatAuthError(error));
      }
    };

    initialize();

    return () => {
      registerAccessTokenResolver(null);
    };
  }, [acquireAccessToken, refreshSession]);

  const login = React.useCallback(async () => {
    setError(null);

    try {
      clearStaleMsalState();
      const instance = getMsalInstance();
      await instance.loginRedirect({
        scopes: [appConfig.entra.apiScope],
        prompt: 'select_account',
        redirectUri: appConfig.entra.redirectUri,
      });
    } catch (error) {
      console.error('Error iniciando sesión con Entra ID:', error);
      if (getErrorCode(error) === 'interaction_in_progress') {
        clearStaleMsalState();
        setStatus('signed-out');
        setError('Se limpió una autenticación atascada. Haz clic otra vez en Entrar con Microsoft.');
        return;
      }

      setStatus('signed-out');
      setError(formatAuthError(error));
    }
  }, []);

  const logout = React.useCallback(async () => {
    const instance = getMsalInstance();
    setSelectedTenantId('');
    await instance.logoutRedirect({
      account: accountRef.current || undefined,
      postLogoutRedirectUri: window.location.origin,
    });
    accountRef.current = null;
    setUser(null);
    setMemberships([]);
    setCurrentTenant(null);
    setStatus('signed-out');
  }, []);

  const switchTenant = React.useCallback(
    (tenantId: string) => {
      const nextTenant = memberships.find((membership) => membership.tenantId === tenantId) || null;
      setCurrentTenant(nextTenant);
      setSelectedTenantId(nextTenant?.tenantId || '');
    },
    [memberships],
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      memberships,
      currentTenant,
      error,
      login,
      logout,
      switchTenant,
      refreshSession,
    }),
    [currentTenant, error, login, logout, memberships, refreshSession, status, user, switchTenant],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const value = React.useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.');
  }

  return value;
};
