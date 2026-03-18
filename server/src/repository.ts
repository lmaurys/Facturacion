import { getPool, sql } from './db.js';
import {
  ENTITY_TYPES,
  type AuthenticatedUser,
  type EntityType,
  type InvoiceFooterNote,
  type InvoiceNumberingSettings,
  type TenantBranding,
  type TenantSettings,
  type TenantSnapshot,
  type TenantSummary,
} from './types.js';

const defaultInvoiceNumbering = (): InvoiceNumberingSettings => ({
  prefix: '',
  startNumber: 1,
  nextNumber: 1,
});

const defaultBranding = (): TenantBranding => ({
  primaryColor: '#0f172a',
  accentColor: '#0ea5e9',
  surfaceColor: '#ffffff',
  logoUrl: '',
  logoDataUrl: '',
});

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const normalizeFooterNotes = (value: unknown): InvoiceFooterNote[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      const note = entry as Partial<InvoiceFooterNote>;
      return {
        id: typeof note.id === 'string' && note.id.trim() ? note.id : `footer_${Date.now()}_${index}`,
        effectiveFrom:
          typeof note.effectiveFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(note.effectiveFrom)
            ? note.effectiveFrom
            : '1970-01-01',
        es: typeof note.es === 'string' ? note.es : '',
        en: typeof note.en === 'string' ? note.en : '',
      };
    })
    .filter((note) => note.es || note.en)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
};

const normalizeInvoiceNumbering = (value: Partial<InvoiceNumberingSettings> | undefined): InvoiceNumberingSettings => {
  const defaults = defaultInvoiceNumbering();
  const prefix = typeof value?.prefix === 'string' ? value.prefix.trim() : defaults.prefix;
  const startNumber = Number.isFinite(value?.startNumber) && Number(value?.startNumber) >= 1
    ? Math.floor(Number(value?.startNumber))
    : defaults.startNumber;
  const nextNumber = Number.isFinite(value?.nextNumber) && Number(value?.nextNumber) >= 1
    ? Math.floor(Number(value?.nextNumber))
    : startNumber;

  return {
    prefix,
    startNumber,
    nextNumber,
  };
};

const normalizeHexColor = (value: unknown, fallback: string): string => {
  const candidate = typeof value === 'string' ? value.trim() : '';
  return /^#([0-9a-fA-F]{6})$/.test(candidate) ? candidate.toLowerCase() : fallback;
};

const normalizeBranding = (value: Partial<TenantBranding> | undefined): TenantBranding => {
  const defaults = defaultBranding();
  return {
    primaryColor: normalizeHexColor(value?.primaryColor, defaults.primaryColor),
    accentColor: normalizeHexColor(value?.accentColor, defaults.accentColor),
    surfaceColor: normalizeHexColor(value?.surfaceColor, defaults.surfaceColor),
    logoUrl: typeof value?.logoUrl === 'string' ? value.logoUrl.trim() : defaults.logoUrl,
    logoDataUrl: typeof value?.logoDataUrl === 'string' ? value.logoDataUrl.trim() : defaults.logoDataUrl,
  };
};

export const ensureTenant = async (
  tenantId: string,
  name: string,
  slug: string,
  sourceUrl?: string,
): Promise<void> => {
  const pool = await getPool();
  await pool
    .request()
    .input('tenantId', sql.NVarChar(128), tenantId)
    .input('name', sql.NVarChar(200), name)
    .input('slug', sql.NVarChar(160), slug)
    .input('sourceUrl', sql.NVarChar(500), sourceUrl || null)
    .query(`
      MERGE dbo.tenants AS target
      USING (SELECT @tenantId AS tenant_id) AS source
      ON target.tenant_id = source.tenant_id
      WHEN MATCHED THEN
        UPDATE SET name = @name, slug = @slug, source_url = COALESCE(@sourceUrl, target.source_url), updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (tenant_id, name, slug, source_url)
        VALUES (@tenantId, @name, @slug, @sourceUrl);
    `);

  await pool
    .request()
    .input('tenantId', sql.NVarChar(128), tenantId)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.tenant_settings WHERE tenant_id = @tenantId)
      BEGIN
        INSERT INTO dbo.tenant_settings (tenant_id, invoice_prefix, invoice_start_number, invoice_next_number, invoice_footer_notes, branding_json)
        VALUES (@tenantId, '', 1, 1, '[]', '{}')
      END
    `);
};

export const getMembershipCount = async (): Promise<number> => {
  const pool = await getPool();
  const result = await pool.request().query('SELECT COUNT(1) AS total FROM dbo.tenant_memberships');
  return Number(result.recordset[0]?.total || 0);
};

export const addMembership = async (
  tenantId: string,
  user: AuthenticatedUser,
  role: string,
): Promise<void> => {
  const pool = await getPool();
  await pool
    .request()
    .input('tenantId', sql.NVarChar(128), tenantId)
    .input('userId', sql.NVarChar(200), user.userId)
    .input('email', sql.NVarChar(320), user.email)
    .input('name', sql.NVarChar(200), user.name)
    .input('role', sql.NVarChar(50), role)
    .query(`
      MERGE dbo.tenant_memberships AS target
      USING (SELECT @tenantId AS tenant_id, @userId AS user_id) AS source
      ON target.tenant_id = source.tenant_id AND target.user_id = source.user_id
      WHEN MATCHED THEN
        UPDATE SET email = @email, display_name = @name, role = @role, updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (tenant_id, user_id, email, display_name, role)
        VALUES (@tenantId, @userId, @email, @name, @role);
    `);
};

export const getMembershipsForUser = async (userId: string): Promise<TenantSummary[]> => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.NVarChar(200), userId)
    .query(`
      SELECT t.tenant_id, t.name, t.slug, m.role
      FROM dbo.tenant_memberships m
      INNER JOIN dbo.tenants t ON t.tenant_id = m.tenant_id
      WHERE m.user_id = @userId
      ORDER BY t.name
    `);

  return result.recordset.map((row: any) => ({
    tenantId: row.tenant_id,
    name: row.name,
    slug: row.slug,
    role: row.role,
  }));
};

export const listDocuments = async <T>(tenantId: string, entityType: EntityType): Promise<T[]> => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('tenantId', sql.NVarChar(128), tenantId)
    .input('entityType', sql.NVarChar(64), entityType)
    .query(`
      SELECT data
      FROM dbo.tenant_documents
      WHERE tenant_id = @tenantId AND entity_type = @entityType
      ORDER BY updated_at DESC
    `);

  return result.recordset.map((row: any) => parseJson<T>(row.data, {} as T));
};

export const getDocument = async <T>(
  tenantId: string,
  entityType: EntityType,
  entityId: string,
): Promise<T | null> => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('tenantId', sql.NVarChar(128), tenantId)
    .input('entityType', sql.NVarChar(64), entityType)
    .input('entityId', sql.NVarChar(128), entityId)
    .query(`
      SELECT TOP 1 data
      FROM dbo.tenant_documents
      WHERE tenant_id = @tenantId AND entity_type = @entityType AND entity_id = @entityId
    `);

  if (!result.recordset[0]?.data) {
    return null;
  }

  return parseJson<T>(result.recordset[0].data, {} as T);
};

export const upsertDocument = async (
  tenantId: string,
  entityType: EntityType,
  entityId: string,
  data: unknown,
): Promise<void> => {
  const pool = await getPool();
  await pool
    .request()
    .input('tenantId', sql.NVarChar(128), tenantId)
    .input('entityType', sql.NVarChar(64), entityType)
    .input('entityId', sql.NVarChar(128), entityId)
    .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(data))
    .query(`
      MERGE dbo.tenant_documents AS target
      USING (SELECT @tenantId AS tenant_id, @entityType AS entity_type, @entityId AS entity_id) AS source
      ON target.tenant_id = source.tenant_id
        AND target.entity_type = source.entity_type
        AND target.entity_id = source.entity_id
      WHEN MATCHED THEN
        UPDATE SET data = @payload, updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (tenant_id, entity_type, entity_id, data)
        VALUES (@tenantId, @entityType, @entityId, @payload);
    `);
};

export const deleteDocument = async (
  tenantId: string,
  entityType: EntityType,
  entityId: string,
): Promise<boolean> => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('tenantId', sql.NVarChar(128), tenantId)
    .input('entityType', sql.NVarChar(64), entityType)
    .input('entityId', sql.NVarChar(128), entityId)
    .query(`
      DELETE FROM dbo.tenant_documents
      WHERE tenant_id = @tenantId AND entity_type = @entityType AND entity_id = @entityId
    `);

  return result.rowsAffected[0] > 0;
};

export const getTenantSettings = async (tenantId: string): Promise<TenantSettings> => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('tenantId', sql.NVarChar(128), tenantId)
    .query(`
      SELECT TOP 1 invoice_prefix, invoice_start_number, invoice_next_number, invoice_footer_notes, branding_json, source_url, last_seeded_at
      FROM dbo.tenant_settings
      WHERE tenant_id = @tenantId
    `);

  const row = result.recordset[0];
  if (!row) {
    return {
      invoiceNumbering: defaultInvoiceNumbering(),
      invoiceFooterNotes: [],
      branding: defaultBranding(),
    };
  }

  return {
    invoiceNumbering: normalizeInvoiceNumbering({
      prefix: row.invoice_prefix,
      startNumber: Number(row.invoice_start_number || 1),
      nextNumber: Number(row.invoice_next_number || row.invoice_start_number || 1),
    }),
    invoiceFooterNotes: normalizeFooterNotes(parseJson(row.invoice_footer_notes, [])),
    branding: normalizeBranding(parseJson(row.branding_json, defaultBranding())),
    sourceUrl: row.source_url || undefined,
    lastSeededAt: row.last_seeded_at ? new Date(row.last_seeded_at).toISOString() : undefined,
  };
};

export const updateTenantSettings = async (
  tenantId: string,
  partial: Partial<TenantSettings>,
): Promise<TenantSettings> => {
  const current = await getTenantSettings(tenantId);
  const next = {
    invoiceNumbering: normalizeInvoiceNumbering(partial.invoiceNumbering || current.invoiceNumbering),
    invoiceFooterNotes: normalizeFooterNotes(partial.invoiceFooterNotes || current.invoiceFooterNotes),
    branding: normalizeBranding(partial.branding || current.branding),
    sourceUrl: partial.sourceUrl ?? current.sourceUrl,
    lastSeededAt: partial.lastSeededAt ?? current.lastSeededAt,
  };

  const pool = await getPool();
  await pool
    .request()
    .input('tenantId', sql.NVarChar(128), tenantId)
    .input('prefix', sql.NVarChar(50), next.invoiceNumbering.prefix)
    .input('startNumber', sql.Int, next.invoiceNumbering.startNumber)
    .input('nextNumber', sql.Int, next.invoiceNumbering.nextNumber)
    .input('footerNotes', sql.NVarChar(sql.MAX), JSON.stringify(next.invoiceFooterNotes))
    .input('branding', sql.NVarChar(sql.MAX), JSON.stringify(next.branding))
    .input('sourceUrl', sql.NVarChar(500), next.sourceUrl || null)
    .input('lastSeededAt', sql.DateTime2, next.lastSeededAt ? new Date(next.lastSeededAt) : null)
    .query(`
      MERGE dbo.tenant_settings AS target
      USING (SELECT @tenantId AS tenant_id) AS source
      ON target.tenant_id = source.tenant_id
      WHEN MATCHED THEN
        UPDATE SET
          invoice_prefix = @prefix,
          invoice_start_number = @startNumber,
          invoice_next_number = @nextNumber,
          invoice_footer_notes = @footerNotes,
          branding_json = @branding,
          source_url = @sourceUrl,
          last_seeded_at = @lastSeededAt,
          updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (tenant_id, invoice_prefix, invoice_start_number, invoice_next_number, invoice_footer_notes, branding_json, source_url, last_seeded_at)
        VALUES (@tenantId, @prefix, @startNumber, @nextNumber, @footerNotes, @branding, @sourceUrl, @lastSeededAt);
    `);

  return next;
};

export const getSnapshot = async (tenantId: string): Promise<TenantSnapshot> => {
  const [clients, courses, invoices, instructors, blackouts, issuerProfiles, transferOptions, settings] =
    await Promise.all([
      listDocuments(tenantId, 'clients'),
      listDocuments(tenantId, 'courses'),
      listDocuments(tenantId, 'invoices'),
      listDocuments(tenantId, 'instructors'),
      listDocuments(tenantId, 'blackouts'),
      listDocuments(tenantId, 'issuerProfiles'),
      listDocuments(tenantId, 'transferOptions'),
      getTenantSettings(tenantId),
    ]);

  return {
    clients,
    courses,
    invoices,
    instructors,
    blackouts,
    issuerProfiles,
    transferOptions,
    invoiceNumbering: settings.invoiceNumbering,
    invoiceFooterNotes: settings.invoiceFooterNotes,
    branding: settings.branding,
    exportDate: new Date().toISOString(),
    version: 5,
    metadata: {
      sourceUrl: settings.sourceUrl,
      lastSeededAt: settings.lastSeededAt,
    },
  };
};

export const replaceEntityCollection = async (
  transaction: sql.Transaction,
  tenantId: string,
  entityType: EntityType,
  records: Array<Record<string, unknown>>,
): Promise<void> => {
  await new sql.Request(transaction)
    .input('tenantId', sql.NVarChar(128), tenantId)
    .input('entityType', sql.NVarChar(64), entityType)
    .query(`
      DELETE FROM dbo.tenant_documents
      WHERE tenant_id = @tenantId AND entity_type = @entityType
    `);

  for (const record of records) {
    const entityId = String(record.id || '');
    if (!entityId) {
      continue;
    }

    await new sql.Request(transaction)
      .input('tenantId', sql.NVarChar(128), tenantId)
      .input('entityType', sql.NVarChar(64), entityType)
      .input('entityId', sql.NVarChar(128), entityId)
      .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(record))
      .query(`
        INSERT INTO dbo.tenant_documents (tenant_id, entity_type, entity_id, data)
        VALUES (@tenantId, @entityType, @entityId, @payload)
      `);
  }
};

export const seedTenantSnapshot = async (
  tenantId: string,
  tenantName: string,
  tenantSlug: string,
  snapshot: TenantSnapshot,
): Promise<void> => {
  await ensureTenant(tenantId, tenantName, tenantSlug, snapshot.metadata?.sourceUrl);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await replaceEntityCollection(transaction, tenantId, 'clients', snapshot.clients as Array<Record<string, unknown>>);
    await replaceEntityCollection(transaction, tenantId, 'courses', snapshot.courses as Array<Record<string, unknown>>);
    await replaceEntityCollection(transaction, tenantId, 'invoices', snapshot.invoices as Array<Record<string, unknown>>);
    await replaceEntityCollection(transaction, tenantId, 'instructors', snapshot.instructors as Array<Record<string, unknown>>);
    await replaceEntityCollection(transaction, tenantId, 'blackouts', snapshot.blackouts as Array<Record<string, unknown>>);
    await replaceEntityCollection(transaction, tenantId, 'issuerProfiles', snapshot.issuerProfiles as Array<Record<string, unknown>>);
    await replaceEntityCollection(transaction, tenantId, 'transferOptions', snapshot.transferOptions as Array<Record<string, unknown>>);

    await new sql.Request(transaction)
      .input('tenantId', sql.NVarChar(128), tenantId)
      .input('prefix', sql.NVarChar(50), snapshot.invoiceNumbering.prefix)
      .input('startNumber', sql.Int, snapshot.invoiceNumbering.startNumber)
      .input('nextNumber', sql.Int, snapshot.invoiceNumbering.nextNumber)
      .input('footerNotes', sql.NVarChar(sql.MAX), JSON.stringify(snapshot.invoiceFooterNotes))
      .input('branding', sql.NVarChar(sql.MAX), JSON.stringify(normalizeBranding(snapshot.branding)))
      .input('sourceUrl', sql.NVarChar(500), snapshot.metadata?.sourceUrl || null)
      .query(`
        UPDATE dbo.tenant_settings
        SET invoice_prefix = @prefix,
            invoice_start_number = @startNumber,
            invoice_next_number = @nextNumber,
            invoice_footer_notes = @footerNotes,
            branding_json = @branding,
            source_url = @sourceUrl,
            last_seeded_at = SYSUTCDATETIME(),
            updated_at = SYSUTCDATETIME()
        WHERE tenant_id = @tenantId
      `);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const reserveNextInvoiceNumber = async (tenantId: string): Promise<string> => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

  try {
    const selectResult = await new sql.Request(transaction)
      .input('tenantId', sql.NVarChar(128), tenantId)
      .query(`
        SELECT TOP 1 invoice_prefix, invoice_start_number, invoice_next_number
        FROM dbo.tenant_settings WITH (UPDLOCK, HOLDLOCK)
        WHERE tenant_id = @tenantId
      `);

    const row = selectResult.recordset[0] || {
      invoice_prefix: '',
      invoice_start_number: 1,
      invoice_next_number: 1,
    };
    const numbering = normalizeInvoiceNumbering({
      prefix: row.invoice_prefix,
      startNumber: Number(row.invoice_start_number || 1),
      nextNumber: Number(row.invoice_next_number || 1),
    });
    const reserved = `${numbering.prefix}${numbering.nextNumber}`;

    await new sql.Request(transaction)
      .input('tenantId', sql.NVarChar(128), tenantId)
      .input('nextNumber', sql.Int, numbering.nextNumber + 1)
      .query(`
        UPDATE dbo.tenant_settings
        SET invoice_next_number = @nextNumber, updated_at = SYSUTCDATETIME()
        WHERE tenant_id = @tenantId
      `);

    await transaction.commit();
    return reserved;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const peekNextInvoiceNumber = async (tenantId: string): Promise<string> => {
  const settings = await getTenantSettings(tenantId);
  return `${settings.invoiceNumbering.prefix}${settings.invoiceNumbering.nextNumber}`;
};

export const countJsonReferences = async (
  tenantId: string,
  entityType: EntityType,
  jsonPath: string,
  value: string,
): Promise<number> => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('tenantId', sql.NVarChar(128), tenantId)
    .input('entityType', sql.NVarChar(64), entityType)
    .input('value', sql.NVarChar(200), value)
    .query(`
      SELECT COUNT(1) AS total
      FROM dbo.tenant_documents
      WHERE tenant_id = @tenantId
        AND entity_type = @entityType
        AND JSON_VALUE(data, '${jsonPath}') = @value
    `);

  return Number(result.recordset[0]?.total || 0);
};

export const getApplicableFooterText = async (
  tenantId: string,
  invoiceDate: string,
  language: 'es' | 'en',
): Promise<string> => {
  const { invoiceFooterNotes } = await getTenantSettings(tenantId);
  const note =
    [...invoiceFooterNotes]
      .filter((entry) => entry.effectiveFrom <= invoiceDate)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
      .at(-1) || invoiceFooterNotes[0];

  if (!note) {
    return '';
  }

  return (language === 'es' ? note.es : note.en).trim();
};

export const getAvailableCoursesForInvoicing = async (tenantId: string, clientId?: string): Promise<unknown[]> => {
  const courses = await listDocuments<Record<string, unknown>>(tenantId, 'courses');
  return courses.filter((course) => {
    const status = String(course.status || '');
    if (clientId && String(course.clientId || '') !== clientId) {
      return false;
    }

    return status === 'creado' || status === 'dictado';
  });
};

export const clearTenantData = async (tenantId: string): Promise<void> => {
  const pool = await getPool();
  await pool
    .request()
    .input('tenantId', sql.NVarChar(128), tenantId)
    .query(`
      DELETE FROM dbo.tenant_documents WHERE tenant_id = @tenantId;
      UPDATE dbo.tenant_settings
      SET invoice_prefix = '',
          invoice_start_number = 1,
          invoice_next_number = 1,
          invoice_footer_notes = '[]',
          branding_json = '{}',
          updated_at = SYSUTCDATETIME()
      WHERE tenant_id = @tenantId;
    `);
};

export const validateInvoiceSubset = async (
  tenantId: string,
  invoiceId: string,
  expectedData: Record<string, unknown>,
): Promise<boolean> => {
  const invoice = await getDocument<Record<string, unknown>>(tenantId, 'invoices', invoiceId);
  if (!invoice) {
    return false;
  }

  return Object.entries(expectedData).every(([key, value]) => {
    return JSON.stringify(invoice[key]) === JSON.stringify(value);
  });
};

export const isKnownEntityType = (value: string): value is EntityType => {
  return ENTITY_TYPES.includes(value as EntityType);
};
