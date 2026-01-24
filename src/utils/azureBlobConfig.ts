export interface AzureBlobConfig {
  /**
   * URL para lectura (GET). Puede ser pública o también con SAS (solo lectura).
   * Ej: https://<account>.blob.core.windows.net/<container>/<blob>.json
   */
  publicUrl?: string;

  /**
   * URL para escritura (PUT) con SAS que permita al menos "w".
   * Ej: https://<account>.blob.core.windows.net/<container>/<blob>.json?<sas>
   */
  blobUrlWithSas?: string;

  /**
   * Opcional: nombre del blob (solo para ayudar a la UI).
   * La sincronización usa publicUrl/blobUrlWithSas ya construidas.
   */
  blobName?: string;
}

const STORAGE_KEY = 'facturacion.azureBlobConfig.v1';

const asCleanString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

export const getAzureBlobConfig = (): AzureBlobConfig | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as AzureBlobConfig;
    const publicUrl = asCleanString((parsed as any).publicUrl);
    const blobUrlWithSas = asCleanString((parsed as any).blobUrlWithSas);
    const blobName = asCleanString((parsed as any).blobName);

    if (!publicUrl && !blobUrlWithSas && !blobName) return null;
    return { publicUrl, blobUrlWithSas, blobName };
  } catch {
    return null;
  }
};

export const setAzureBlobConfig = (config: AzureBlobConfig): void => {
  const publicUrl = asCleanString(config.publicUrl);
  const blobUrlWithSas = asCleanString(config.blobUrlWithSas);
  const blobName = asCleanString(config.blobName);

  if (!publicUrl && !blobUrlWithSas && !blobName) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      publicUrl,
      blobUrlWithSas,
      blobName,
      savedAt: new Date().toISOString()
    })
  );
};

export const clearAzureBlobConfig = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

export const derivePublicUrlFromSasUrl = (sasUrl?: string): string | undefined => {
  const cleaned = asCleanString(sasUrl);
  if (!cleaned) return undefined;
  const idx = cleaned.indexOf('?');
  return idx === -1 ? cleaned : cleaned.slice(0, idx);
};

const parseUrlSafe = (value?: string): URL | null => {
  const cleaned = asCleanString(value);
  if (!cleaned) return null;
  try {
    return new URL(cleaned);
  } catch {
    return null;
  }
};

/**
 * Si el SAS apunta al container (sr=c), devuelve true.
 */
export const isContainerSasUrl = (sasUrl?: string): boolean => {
  const u = parseUrlSafe(sasUrl);
  if (!u) return false;
  const sr = u.searchParams.get('sr');
  if (sr === 'c') return true;

  // Heurística adicional: path sin extensión y sin "." suele ser container.
  const path = u.pathname;
  const last = path.split('/').filter(Boolean).slice(-1)[0] || '';
  return !last.includes('.') && last.length > 0;
};

export const buildBlobUrlFromContainerSas = (containerSasUrl: string, blobName: string): string | null => {
  const u = parseUrlSafe(containerSasUrl);
  const cleanBlobName = asCleanString(blobName);
  if (!u || !cleanBlobName) return null;

  const containerBase = `${u.origin}${u.pathname.replace(/\/$/, '')}`;
  return `${containerBase}/${encodeURIComponent(cleanBlobName)}?${u.searchParams.toString()}`;
};

export const ensureBlobSasUrl = (sasUrlOrBlobUrl?: string, blobName?: string): string | undefined => {
  const cleaned = asCleanString(sasUrlOrBlobUrl);
  if (!cleaned) return undefined;

  if (isContainerSasUrl(cleaned)) {
    const built = buildBlobUrlFromContainerSas(cleaned, blobName || '');
    return built ?? undefined;
  }

  // Ya parece apuntar a un blob
  return cleaned;
};

export const ensureBlobPublicUrl = (publicOrContainerOrBlob?: string, blobName?: string): string | undefined => {
  const cleaned = asCleanString(publicOrContainerOrBlob);
  const cleanBlobName = asCleanString(blobName);

  if (!cleaned) return undefined;

  // Si viene un SAS, quita query
  const withoutQuery = derivePublicUrlFromSasUrl(cleaned) || cleaned;
  const u = parseUrlSafe(withoutQuery);
  if (!u) return withoutQuery;

  if (!cleanBlobName) return withoutQuery;

  // Si la URL parece ser de container, agregamos el blobName
  const last = u.pathname.split('/').filter(Boolean).slice(-1)[0] || '';
  const isContainer = !last.includes('.') && last.length > 0;
  if (!isContainer) return withoutQuery;

  const base = `${u.origin}${u.pathname.replace(/\/$/, '')}`;
  return `${base}/${encodeURIComponent(cleanBlobName)}`;
};
