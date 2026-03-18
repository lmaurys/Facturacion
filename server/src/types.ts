export const ENTITY_TYPES = [
  'clients',
  'courses',
  'invoices',
  'instructors',
  'blackouts',
  'issuerProfiles',
  'transferOptions',
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export interface InvoiceNumberingSettings {
  prefix: string;
  startNumber: number;
  nextNumber: number;
}

export interface InvoiceFooterNote {
  id: string;
  effectiveFrom: string;
  es: string;
  en: string;
}

export interface TenantBranding {
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  logoUrl?: string;
  logoDataUrl?: string;
}

export interface TenantSettings {
  invoiceNumbering: InvoiceNumberingSettings;
  invoiceFooterNotes: InvoiceFooterNote[];
  branding: TenantBranding;
  sourceUrl?: string;
  lastSeededAt?: string;
}

export interface TenantSummary {
  tenantId: string;
  name: string;
  slug: string;
  role: string;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  directoryTenantId?: string;
}

export interface TenantSnapshot {
  clients: unknown[];
  courses: unknown[];
  invoices: unknown[];
  instructors: unknown[];
  blackouts: unknown[];
  issuerProfiles: unknown[];
  transferOptions: unknown[];
  invoiceNumbering: InvoiceNumberingSettings;
  invoiceFooterNotes: InvoiceFooterNote[];
  branding: TenantBranding;
  exportDate: string;
  version: number;
  metadata?: {
    sourceUrl?: string;
    lastSeededAt?: string;
  };
}

export interface RequestContext {
  user: AuthenticatedUser;
  tenant: TenantSummary;
}
