import { config } from './config.js';
import type { TenantSnapshot } from './types.js';

export const loadSeedSnapshot = async (): Promise<TenantSnapshot> => {
  const response = await fetch(config.seedSourceUrl, {
    headers: {
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`No se pudo cargar el JSON base (${response.status}).`);
  }

  const raw = (await response.json()) as Record<string, unknown>;
  const invoiceNumbering = (raw.invoiceNumbering || {}) as Record<string, unknown>;
  const branding = (raw.branding || {}) as Record<string, unknown>;

  return {
    clients: Array.isArray(raw.clients) ? raw.clients : [],
    courses: Array.isArray(raw.courses) ? raw.courses : [],
    invoices: Array.isArray(raw.invoices) ? raw.invoices : [],
    instructors: Array.isArray(raw.instructors) ? raw.instructors : [],
    blackouts: Array.isArray(raw.blackouts) ? raw.blackouts : [],
    issuerProfiles: Array.isArray(raw.issuerProfiles) ? raw.issuerProfiles : [],
    transferOptions: Array.isArray(raw.transferOptions) ? raw.transferOptions : [],
    invoiceNumbering: {
      prefix: typeof invoiceNumbering.prefix === 'string' ? invoiceNumbering.prefix : '',
      startNumber: Number(invoiceNumbering.startNumber || 1),
      nextNumber: Number(invoiceNumbering.nextNumber || invoiceNumbering.startNumber || 1),
    },
    invoiceFooterNotes: Array.isArray(raw.invoiceFooterNotes) ? (raw.invoiceFooterNotes as any[]) : [],
    branding: {
      primaryColor: typeof branding.primaryColor === 'string' ? branding.primaryColor : '#0f172a',
      accentColor: typeof branding.accentColor === 'string' ? branding.accentColor : '#0ea5e9',
      surfaceColor: typeof branding.surfaceColor === 'string' ? branding.surfaceColor : '#ffffff',
      logoUrl: typeof branding.logoUrl === 'string' ? branding.logoUrl : '',
      logoDataUrl: typeof branding.logoDataUrl === 'string' ? branding.logoDataUrl : '',
    },
    exportDate: new Date().toISOString(),
    version: 5,
    metadata: {
      sourceUrl: config.seedSourceUrl,
      lastSeededAt: new Date().toISOString(),
    },
  };
};
