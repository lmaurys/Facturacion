import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { config, isAuthConfigured } from './config.js';
import { getPool } from './db.js';
import {
  clearTenantData,
  countJsonReferences,
  deleteDocument,
  getApplicableFooterText,
  getAvailableCoursesForInvoicing,
  getDocument,
  getMembershipsForUser,
  getSnapshot,
  getTenantSettings,
  isKnownEntityType,
  peekNextInvoiceNumber,
  reserveNextInvoiceNumber,
  seedTenantSnapshot,
  updateTenantSettings,
  upsertDocument,
  validateInvoiceSubset,
} from './repository.js';
import { requireAuth, requireTenantContext, type AuthenticatedRequest } from './auth.js';
import type { TenantSnapshot } from './types.js';

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const getParam = (value: string | string[]): string => (Array.isArray(value) ? value[0] : value);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../../dist');

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const resolvePublicOrigin = (req: express.Request): string => {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = typeof forwardedProto === 'string' ? forwardedProto.split(',')[0] : req.protocol;
  const host = req.get('host') || 'localhost';
  return `${protocol}://${host}`;
};

const resolveApiScope = (): string => {
  const audience = config.entra.audience.trim();
  if (audience) {
    return audience.endsWith('/access_as_user') ? audience : `${audience}/access_as_user`;
  }

  return config.entra.clientId ? `api://${config.entra.clientId}/access_as_user` : '';
};

const buildPublicRuntimeConfig = (req: express.Request) => {
  const origin = trimTrailingSlash(resolvePublicOrigin(req));
  return {
    apiBaseUrl: origin,
    entra: {
      clientId: config.entra.clientId,
      tenantId: config.entra.allowAnyTenant ? 'common' : config.entra.tenantId,
      redirectUri: origin,
      apiScope: resolveApiScope(),
    },
  };
};

const setRuntimeConfigHeaders = (res: express.Response): void => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
};

const settingsSchema = z.object({
  invoiceNumbering: z
    .object({
      prefix: z.string(),
      startNumber: z.number().int().min(1),
      nextNumber: z.number().int().min(1),
    })
    .optional(),
  invoiceFooterNotes: z
    .array(
      z.object({
        id: z.string(),
        effectiveFrom: z.string(),
        es: z.string(),
        en: z.string(),
      }),
    )
    .optional(),
  branding: z
    .object({
      primaryColor: z.string(),
      accentColor: z.string(),
      surfaceColor: z.string(),
      logoUrl: z.string().optional(),
      logoDataUrl: z.string().optional(),
    })
    .optional(),
});

app.get('/api/health', async (_req, res) => {
  try {
    if (!config.azureSqlConnectionString) {
      res.json({
        ok: true,
        database: 'not-configured',
        authConfigured: isAuthConfigured(),
      });
      return;
    }

    await getPool();
    res.json({
      ok: true,
      database: 'connected',
      authConfigured: isAuthConfigured(),
    });
  } catch (error) {
    console.error('Healthcheck failed:', error);
    res.status(500).json({ ok: false, database: 'error' });
  }
});

app.get('/runtime-config.json', (req, res) => {
  setRuntimeConfigHeaders(res);
  res.json(buildPublicRuntimeConfig(req));
});

app.get('/api/public-config', (req, res) => {
  setRuntimeConfigHeaders(res);
  res.json(buildPublicRuntimeConfig(req));
});

app.get('/api/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const memberships = await getMembershipsForUser(req.authUser!.userId);
    res.json({
      user: req.authUser,
      memberships,
      defaultTenantId: memberships.length === 1 ? memberships[0].tenantId : null,
    });
  } catch (error) {
    console.error('Error resolving /api/me:', error);
    res.status(500).json({ message: 'No se pudo cargar la sesión.' });
  }
});

app.use('/api', requireAuth, requireTenantContext);

app.get('/api/data/snapshot', async (req: AuthenticatedRequest, res) => {
  try {
    const snapshot = await getSnapshot(req.tenant!.tenantId);
    res.json(snapshot);
  } catch (error) {
    console.error('Error loading snapshot:', error);
    res.status(500).json({ message: 'No se pudo cargar la información del tenant.' });
  }
});

app.get('/api/data/settings', async (req: AuthenticatedRequest, res) => {
  const settings = await getTenantSettings(req.tenant!.tenantId);
  res.json(settings);
});

app.put('/api/data/settings', async (req: AuthenticatedRequest, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Datos de configuración inválidos.' });
    return;
  }

  const settings = await updateTenantSettings(req.tenant!.tenantId, parsed.data);
  res.json(settings);
});

app.get('/api/data/footer-text', async (req: AuthenticatedRequest, res) => {
  const invoiceDate = String(req.query.invoiceDate || '');
  const language = req.query.language === 'en' ? 'en' : 'es';
  const text = await getApplicableFooterText(req.tenant!.tenantId, invoiceDate, language);
  res.json({ text });
});

app.get('/api/data/next-invoice-number', async (req: AuthenticatedRequest, res) => {
  const invoiceNumber = await peekNextInvoiceNumber(req.tenant!.tenantId);
  res.json({ invoiceNumber });
});

app.post('/api/data/reserve-invoice-number', async (req: AuthenticatedRequest, res) => {
  const invoiceNumber = await reserveNextInvoiceNumber(req.tenant!.tenantId);
  res.json({ invoiceNumber });
});

app.get('/api/data/available-courses', async (req: AuthenticatedRequest, res) => {
  const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
  const courses = await getAvailableCoursesForInvoicing(req.tenant!.tenantId, clientId);
  res.json(courses);
});

app.get('/api/data/:entityType', async (req: AuthenticatedRequest, res) => {
  const entityType = getParam(req.params.entityType);
  if (!isKnownEntityType(entityType)) {
    res.status(404).json({ message: 'Tipo de entidad desconocido.' });
    return;
  }

  const items = await getSnapshot(req.tenant!.tenantId);
  res.json(items[entityType]);
});

app.get('/api/data/:entityType/:entityId', async (req: AuthenticatedRequest, res) => {
  const entityType = getParam(req.params.entityType);
  const entityId = getParam(req.params.entityId);
  if (!isKnownEntityType(entityType)) {
    res.status(404).json({ message: 'Tipo de entidad desconocido.' });
    return;
  }

  const item = await getDocument(req.tenant!.tenantId, entityType, entityId);
  if (!item) {
    res.status(404).json({ message: 'Registro no encontrado.' });
    return;
  }

  res.json(item);
});

app.post('/api/data/:entityType', async (req: AuthenticatedRequest, res) => {
  const entityType = getParam(req.params.entityType);
  if (!isKnownEntityType(entityType)) {
    res.status(404).json({ message: 'Tipo de entidad desconocido.' });
    return;
  }

  const payload = req.body;
  const entityId = String(payload?.id || '').trim();
  if (!entityId) {
    res.status(400).json({ message: 'Cada registro debe incluir un id.' });
    return;
  }

  await upsertDocument(req.tenant!.tenantId, entityType, entityId, payload);
  res.status(201).json(payload);
});

app.put('/api/data/:entityType/:entityId', async (req: AuthenticatedRequest, res) => {
  const entityType = getParam(req.params.entityType);
  const entityId = getParam(req.params.entityId);
  if (!isKnownEntityType(entityType)) {
    res.status(404).json({ message: 'Tipo de entidad desconocido.' });
    return;
  }

  const payload = {
    ...req.body,
    id: entityId,
  };
  await upsertDocument(req.tenant!.tenantId, entityType, entityId, payload);
  res.json(payload);
});

app.delete('/api/data/:entityType/:entityId', async (req: AuthenticatedRequest, res) => {
  const entityType = getParam(req.params.entityType);
  const entityId = getParam(req.params.entityId);
  if (!isKnownEntityType(entityType)) {
    res.status(404).json({ message: 'Tipo de entidad desconocido.' });
    return;
  }

  if (entityType === 'instructors') {
    const inUse = await countJsonReferences(req.tenant!.tenantId, 'courses', '$.instructorId', entityId);
    if (inUse > 0) {
      const instructor = await getDocument<Record<string, unknown>>(req.tenant!.tenantId, 'instructors', entityId);
      if (instructor) {
        await upsertDocument(req.tenant!.tenantId, 'instructors', entityId, {
          ...instructor,
          active: false,
        });
      }
      res.json({ removed: false, reason: 'in-use-marked-inactive' });
      return;
    }
  }

  if (entityType === 'issuerProfiles') {
    const inUse = await countJsonReferences(req.tenant!.tenantId, 'invoices', '$.issuerId', entityId);
    if (inUse > 0) {
      res.json({ removed: false, reason: 'in-use' });
      return;
    }
  }

  if (entityType === 'transferOptions') {
    const inUse = await countJsonReferences(req.tenant!.tenantId, 'invoices', '$.transferOptionId', entityId);
    if (inUse > 0) {
      res.json({ removed: false, reason: 'in-use' });
      return;
    }
  }

  const removed = await deleteDocument(req.tenant!.tenantId, entityType, entityId);
  res.json(entityType === 'instructors' || entityType === 'issuerProfiles' || entityType === 'transferOptions' ? { removed } : { success: removed });
});

app.post('/api/admin/clear', async (req: AuthenticatedRequest, res) => {
  await clearTenantData(req.tenant!.tenantId);
  res.json({ success: true });
});

app.post('/api/admin/seed-snapshot', async (req: AuthenticatedRequest, res) => {
  if (req.tenant?.role !== 'owner') {
    res.status(403).json({ message: 'Solo un owner puede sembrar el tenant.' });
    return;
  }

  const snapshot = req.body as TenantSnapshot;
  await seedTenantSnapshot(req.tenant!.tenantId, req.tenant!.name, req.tenant!.slug, snapshot);
  res.json({ success: true });
});

app.post('/api/admin/validate-invoice/:invoiceId', async (req: AuthenticatedRequest, res) => {
  const ok = await validateInvoiceSubset(req.tenant!.tenantId, getParam(req.params.invoiceId), req.body || {});
  res.json({ ok });
});

app.use(express.static(distPath));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    next();
    return;
  }

  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(config.port, () => {
  console.log(`API SaaS escuchando en http://localhost:${config.port}`);
});
