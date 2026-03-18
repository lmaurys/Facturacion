import type { TenantBranding } from '../types';

export const defaultTenantBranding = (): TenantBranding => ({
  primaryColor: '#0f172a',
  accentColor: '#0ea5e9',
  surfaceColor: '#ffffff',
  logoUrl: '',
  logoDataUrl: '',
});

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/;

export const normalizeBranding = (value?: Partial<TenantBranding> | null): TenantBranding => {
  const defaults = defaultTenantBranding();
  return {
    primaryColor: HEX_COLOR_PATTERN.test(value?.primaryColor || '') ? String(value?.primaryColor).toLowerCase() : defaults.primaryColor,
    accentColor: HEX_COLOR_PATTERN.test(value?.accentColor || '') ? String(value?.accentColor).toLowerCase() : defaults.accentColor,
    surfaceColor: HEX_COLOR_PATTERN.test(value?.surfaceColor || '') ? String(value?.surfaceColor).toLowerCase() : defaults.surfaceColor,
    logoUrl: typeof value?.logoUrl === 'string' ? value.logoUrl.trim() : defaults.logoUrl,
    logoDataUrl: typeof value?.logoDataUrl === 'string' ? value.logoDataUrl.trim() : defaults.logoDataUrl,
  };
};

export const readLogoSource = (branding?: Partial<TenantBranding> | null): string =>
  (branding?.logoDataUrl || branding?.logoUrl || '').trim();

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = normalizeBranding({ primaryColor: hex }).primaryColor.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
};

const asRgb = (hex: string): string => {
  const [r, g, b] = hexToRgb(hex);
  return `${r} ${g} ${b}`;
};

export const getContrastColor = (hex: string): string => {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance >= 145 ? '#0f172a' : '#ffffff';
};

export const toRgba = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const applyBrandingToDocument = (value?: Partial<TenantBranding> | null): TenantBranding => {
  const branding = normalizeBranding(value);
  const root = document.documentElement;
  root.style.setProperty('--tenant-primary', branding.primaryColor);
  root.style.setProperty('--tenant-primary-rgb', asRgb(branding.primaryColor));
  root.style.setProperty('--tenant-accent', branding.accentColor);
  root.style.setProperty('--tenant-accent-rgb', asRgb(branding.accentColor));
  root.style.setProperty('--tenant-surface', branding.surfaceColor);
  root.style.setProperty('--tenant-surface-rgb', asRgb(branding.surfaceColor));
  root.style.setProperty('--tenant-primary-contrast', getContrastColor(branding.primaryColor));
  return branding;
};
