import { appConfig } from '../config/appConfig';
import { getAccessToken, getSelectedTenantId } from './authState';

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

const buildUrl = (path: string): string => {
  if (!appConfig.apiBaseUrl) {
    return path;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return `${appConfig.apiBaseUrl}${path}`;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');

  const token = await getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const tenantId = getSelectedTenantId();
  if (tenantId) {
    headers.set('x-tenant-id', tenantId);
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new ApiError(
      response.status,
      typeof payload === 'object' && payload && 'message' in payload
        ? String((payload as { message?: unknown }).message)
        : 'Error inesperado en la API.',
      payload,
    );
  }

  return payload as T;
};

export const apiGet = <T>(path: string): Promise<T> => request<T>(path);

export const apiPost = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const apiPut = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, {
    method: 'PUT',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const apiDelete = <T>(path: string): Promise<T> =>
  request<T>(path, {
    method: 'DELETE',
  });
