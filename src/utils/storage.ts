import {
  Blackout,
  Client,
  Course,
  Currency,
  InvoiceFooterNote,
  InvoiceFromCourse,
  InvoiceNumberingSettings,
  IssuerProfile,
  Language,
  TenantBranding,
  TransferOptionProfile,
  type Instructor,
} from '../types';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/apiClient';
import { defaultTenantBranding, normalizeBranding } from './tenantBranding';

type Snapshot = {
  clients: Client[];
  courses: Course[];
  invoices: InvoiceFromCourse[];
  instructors: Instructor[];
  blackouts: Blackout[];
  issuerProfiles: IssuerProfile[];
  transferOptions: TransferOptionProfile[];
  invoiceNumbering: InvoiceNumberingSettings;
  invoiceFooterNotes: InvoiceFooterNote[];
  branding: TenantBranding;
  exportDate: string;
  version: number;
  metadata?: {
    sourceUrl?: string;
    lastSeededAt?: string;
  };
};

const defaultSnapshot = (): Snapshot => ({
  clients: [],
  courses: [],
  invoices: [],
  instructors: [],
  blackouts: [],
  issuerProfiles: [],
  transferOptions: [],
  invoiceNumbering: {
    prefix: '',
    startNumber: 1,
    nextNumber: 1,
  },
  invoiceFooterNotes: [],
  branding: defaultTenantBranding(),
  exportDate: new Date().toISOString(),
  version: 5,
});

let snapshotCache: Snapshot | null = null;
let pendingSnapshotPromise: Promise<Snapshot> | null = null;

const normalizeInvoice = (invoice: InvoiceFromCourse): InvoiceFromCourse => ({
  ...invoice,
  courseIds: Array.isArray(invoice.courseIds) ? invoice.courseIds : [],
  items: Array.isArray(invoice.items) ? invoice.items : [],
  currency: (invoice.currency || 'USD') as Currency,
  issuerId: (invoice.issuerId || (invoice as InvoiceFromCourse & { issuer?: string }).issuer || '') as string,
  transferOptionId: (invoice.transferOptionId || '') as string,
});

const dispatchEvent = (name: string): void => {
  window.dispatchEvent(new CustomEvent(name));
};

const refreshSnapshot = async (): Promise<Snapshot> => {
  if (!pendingSnapshotPromise) {
    pendingSnapshotPromise = apiGet<Snapshot>('/api/data/snapshot')
      .then((snapshot) => {
        snapshotCache = {
          ...snapshot,
          invoices: snapshot.invoices.map(normalizeInvoice),
          branding: normalizeBranding(snapshot.branding),
        };
        return snapshotCache;
      })
      .finally(() => {
        pendingSnapshotPromise = null;
      });
  }

  return pendingSnapshotPromise;
};

const ensureSnapshot = async (): Promise<Snapshot> => {
  return snapshotCache || refreshSnapshot();
};

const updateSnapshotEntity = <K extends keyof Snapshot>(key: K, value: Snapshot[K]): void => {
  const current = snapshotCache || defaultSnapshot();
  snapshotCache = {
    ...current,
    [key]: value,
    exportDate: new Date().toISOString(),
  };
};

const generateId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

const postEntity = async <T extends { id: string }>(
  entityType: string,
  data: T,
  eventName: string,
): Promise<T | null> => {
  const created = await apiPost<T>(`/api/data/${entityType}`, data);
  dispatchEvent(eventName);
  return created;
};

const putEntity = async <T extends { id: string }>(
  entityType: string,
  id: string,
  data: T,
  eventName: string,
): Promise<T | null> => {
  const updated = await apiPut<T>(`/api/data/${entityType}/${id}`, data);
  dispatchEvent(eventName);
  return updated;
};

export const forceSaveToAzure = async (): Promise<boolean> => true;

export const debugCacheState = (): void => {
  console.log('Snapshot local actual:', snapshotCache);
};

export const debugCompleteSystem = (): void => {
  console.log('Snapshot del sistema SaaS:', snapshotCache);
};

export const initializeFromAzure = async (): Promise<boolean> => {
  try {
    await refreshSnapshot();
    return true;
  } catch (error) {
    console.error('No se pudo inicializar desde el API SaaS:', error);
    return false;
  }
};

export const emergencyLoadFromAzure = initializeFromAzure;
export const loadOnlyRealDataFromAzure = initializeFromAzure;
export const forceReloadFromAzure = initializeFromAzure;

export const loadCourses = async (): Promise<Course[]> => {
  const snapshot = await ensureSnapshot();
  return [...snapshot.courses].sort((a, b) => b.startDate.localeCompare(a.startDate));
};

export const addCourse = async (courseData: Omit<Course, 'id'>): Promise<Course | null> => {
  const course: Course = { ...courseData, id: generateCourseId() };
  const created = await postEntity('courses', course, 'courseUpdated');
  if (created) {
    const courses = await loadCourses();
    updateSnapshotEntity('courses', [created, ...courses.filter((entry) => entry.id !== created.id)]);
  }
  return created;
};

export const updateCourse = async (courseId: string, courseData: Omit<Course, 'id'>): Promise<Course | null> => {
  const updated = await putEntity('courses', courseId, { ...courseData, id: courseId }, 'courseUpdated');
  if (updated) {
    const snapshot = await ensureSnapshot();
    updateSnapshotEntity(
      'courses',
      snapshot.courses.map((course) => (course.id === courseId ? updated : course)),
    );
  }
  return updated;
};

export const deleteCourse = async (courseId: string): Promise<boolean> => {
  const response = await apiDelete<{ success?: boolean }>(`/api/data/courses/${courseId}`);
  const success = Boolean(response.success);
  if (success) {
    const snapshot = await ensureSnapshot();
    updateSnapshotEntity(
      'courses',
      snapshot.courses.filter((course) => course.id !== courseId),
    );
    dispatchEvent('courseUpdated');
  }
  return success;
};

export const getCourseById = async (courseId: string): Promise<Course | null> =>
  apiGet<Course>(`/api/data/courses/${courseId}`).catch(() => null);

export const loadClients = async (): Promise<Client[]> => {
  const snapshot = await ensureSnapshot();
  return [...snapshot.clients].sort((a, b) => a.name.localeCompare(b.name));
};

export const addClient = async (clientData: Omit<Client, 'id'>): Promise<Client | null> => {
  const client: Client = { ...clientData, id: generateClientId() };
  const created = await postEntity('clients', client, 'clientUpdated');
  if (created) {
    const snapshot = await ensureSnapshot();
    updateSnapshotEntity(
      'clients',
      [...snapshot.clients.filter((entry) => entry.id !== created.id), created].sort((a, b) => a.name.localeCompare(b.name)),
    );
  }
  return created;
};

export const updateClient = async (clientId: string, clientData: Omit<Client, 'id'>): Promise<Client | null> => {
  const updated = await putEntity('clients', clientId, { ...clientData, id: clientId }, 'clientUpdated');
  if (updated) {
    const snapshot = await ensureSnapshot();
    updateSnapshotEntity(
      'clients',
      snapshot.clients
        .map((client) => (client.id === clientId ? updated : client))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }
  return updated;
};

export const deleteClient = async (clientId: string): Promise<boolean> => {
  const response = await apiDelete<{ success?: boolean }>(`/api/data/clients/${clientId}`);
  const success = Boolean(response.success);
  if (success) {
    const snapshot = await ensureSnapshot();
    updateSnapshotEntity(
      'clients',
      snapshot.clients.filter((client) => client.id !== clientId),
    );
    dispatchEvent('clientUpdated');
  }
  return success;
};

export const getClientById = async (clientId: string): Promise<Client | null> =>
  apiGet<Client>(`/api/data/clients/${clientId}`).catch(() => null);

export const loadInvoices = async (): Promise<InvoiceFromCourse[]> => {
  const snapshot = await ensureSnapshot();
  return [...snapshot.invoices].map(normalizeInvoice).sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
};

export const addInvoice = async (invoiceData: Omit<InvoiceFromCourse, 'id'>): Promise<InvoiceFromCourse | null> => {
  const invoice = normalizeInvoice({ ...invoiceData, id: generateInvoiceId() });
  const created = await postEntity('invoices', invoice, 'invoiceUpdated');
  if (created) {
    const snapshot = await ensureSnapshot();
    updateSnapshotEntity(
      'invoices',
      [normalizeInvoice(created), ...snapshot.invoices.filter((entry) => entry.id !== created.id)],
    );
  }
  return created ? normalizeInvoice(created) : null;
};

export const updateInvoice = async (
  invoiceId: string,
  invoiceData: Omit<InvoiceFromCourse, 'id'>,
): Promise<InvoiceFromCourse | null> => {
  const updated = await putEntity('invoices', invoiceId, normalizeInvoice({ ...invoiceData, id: invoiceId }), 'invoiceUpdated');
  if (updated) {
    const snapshot = await ensureSnapshot();
    updateSnapshotEntity(
      'invoices',
      snapshot.invoices.map((invoice) => (invoice.id === invoiceId ? normalizeInvoice(updated) : invoice)),
    );
  }
  return updated ? normalizeInvoice(updated) : null;
};

export const deleteInvoice = async (invoiceId: string): Promise<boolean> => {
  const response = await apiDelete<{ success?: boolean }>(`/api/data/invoices/${invoiceId}`);
  const success = Boolean(response.success);
  if (success) {
    const snapshot = await ensureSnapshot();
    updateSnapshotEntity(
      'invoices',
      snapshot.invoices.filter((invoice) => invoice.id !== invoiceId),
    );
    dispatchEvent('invoiceUpdated');
  }
  return success;
};

export const getInvoiceById = async (invoiceId: string): Promise<InvoiceFromCourse | null> => {
  const invoice = await apiGet<InvoiceFromCourse>(`/api/data/invoices/${invoiceId}`).catch(() => null);
  return invoice ? normalizeInvoice(invoice) : null;
};

export const generateCourseId = (): string => generateId('course');
export const generateClientId = (): string => generateId('client');
export const generateInvoiceId = (): string => generateId('invoice');
export const generateInstructorId = (): string => generateId('instructor');
export const generateIssuerId = (): string => generateId('issuer');
export const generateTransferOptionId = (): string => generateId('transfer');

export const loadInstructors = async (): Promise<Instructor[]> => {
  const snapshot = await ensureSnapshot();
  return [...snapshot.instructors].sort((a, b) => a.name.localeCompare(b.name));
};

export const addInstructor = async (data: Omit<Instructor, 'id'>): Promise<Instructor | null> => {
  const instructor: Instructor = { ...data, id: generateInstructorId() };
  const created = await postEntity('instructors', instructor, 'instructorUpdated');
  if (created) {
    const snapshot = await ensureSnapshot();
    updateSnapshotEntity('instructors', [...snapshot.instructors.filter((entry) => entry.id !== created.id), created]);
  }
  return created;
};

export const updateInstructor = async (instructorId: string, data: Omit<Instructor, 'id'>): Promise<Instructor | null> => {
  const updated = await putEntity('instructors', instructorId, { ...data, id: instructorId }, 'instructorUpdated');
  if (updated) {
    const snapshot = await ensureSnapshot();
    updateSnapshotEntity(
      'instructors',
      snapshot.instructors.map((instructor) => (instructor.id === instructorId ? updated : instructor)),
    );
  }
  return updated;
};

export const deleteInstructor = async (instructorId: string): Promise<{ removed: boolean; reason?: string }> => {
  const response = await apiDelete<{ removed: boolean; reason?: string }>(`/api/data/instructors/${instructorId}`);
  await refreshSnapshot();
  dispatchEvent('instructorUpdated');
  return response;
};

export const loadIssuerProfiles = async (): Promise<IssuerProfile[]> => {
  const snapshot = await ensureSnapshot();
  return [...snapshot.issuerProfiles];
};

export const addIssuerProfile = async (
  data: Omit<IssuerProfile, 'id'> & { id?: string },
): Promise<IssuerProfile | null> => {
  const issuer: IssuerProfile = { ...data, id: data.id || generateIssuerId() };
  const created = await postEntity('issuerProfiles', issuer, 'issuerUpdated');
  if (created) {
    const snapshot = await ensureSnapshot();
    updateSnapshotEntity(
      'issuerProfiles',
      [...snapshot.issuerProfiles.filter((entry) => entry.id !== created.id), created],
    );
  }
  return created;
};

export const updateIssuerProfile = async (
  issuerId: string,
  data: Omit<IssuerProfile, 'id'>,
): Promise<IssuerProfile | null> => {
  const updated = await putEntity('issuerProfiles', issuerId, { ...data, id: issuerId }, 'issuerUpdated');
  if (updated) {
    const snapshot = await ensureSnapshot();
    updateSnapshotEntity(
      'issuerProfiles',
      snapshot.issuerProfiles.map((issuer) => (issuer.id === issuerId ? updated : issuer)),
    );
  }
  return updated;
};

export const deleteIssuerProfile = async (issuerId: string): Promise<{ removed: boolean; reason?: string }> => {
  const response = await apiDelete<{ removed: boolean; reason?: string }>(`/api/data/issuerProfiles/${issuerId}`);
  await refreshSnapshot();
  dispatchEvent('issuerUpdated');
  return response;
};

export const loadTransferOptions = async (): Promise<TransferOptionProfile[]> => {
  const snapshot = await ensureSnapshot();
  return [...snapshot.transferOptions];
};

export const addTransferOption = async (
  data: Omit<TransferOptionProfile, 'id'> & { id?: string },
): Promise<TransferOptionProfile | null> => {
  const transfer: TransferOptionProfile = { ...data, id: data.id || generateTransferOptionId() };
  const created = await postEntity('transferOptions', transfer, 'transferOptionUpdated');
  if (created) {
    const snapshot = await ensureSnapshot();
    updateSnapshotEntity(
      'transferOptions',
      [...snapshot.transferOptions.filter((entry) => entry.id !== created.id), created],
    );
  }
  return created;
};

export const updateTransferOption = async (
  transferOptionId: string,
  data: Omit<TransferOptionProfile, 'id'>,
): Promise<TransferOptionProfile | null> => {
  const updated = await putEntity(
    'transferOptions',
    transferOptionId,
    { ...data, id: transferOptionId },
    'transferOptionUpdated',
  );
  if (updated) {
    const snapshot = await ensureSnapshot();
    updateSnapshotEntity(
      'transferOptions',
      snapshot.transferOptions.map((option) => (option.id === transferOptionId ? updated : option)),
    );
  }
  return updated;
};

export const deleteTransferOption = async (
  transferOptionId: string,
): Promise<{ removed: boolean; reason?: string }> => {
  const response = await apiDelete<{ removed: boolean; reason?: string }>(
    `/api/data/transferOptions/${transferOptionId}`,
  );
  await refreshSnapshot();
  dispatchEvent('transferOptionUpdated');
  return response;
};

export const loadInvoiceFooterNotes = async (): Promise<InvoiceFooterNote[]> => {
  const snapshot = await ensureSnapshot();
  return [...snapshot.invoiceFooterNotes];
};

export const addInvoiceFooterNote = async (
  data: Omit<InvoiceFooterNote, 'id'>,
): Promise<InvoiceFooterNote | null> => {
  const snapshot = await ensureSnapshot();
  const note: InvoiceFooterNote = {
    ...data,
    id: `footer_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  };
  const nextNotes = [...snapshot.invoiceFooterNotes, note].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  await apiPut('/api/data/settings', { invoiceFooterNotes: nextNotes });
  updateSnapshotEntity('invoiceFooterNotes', nextNotes);
  dispatchEvent('invoiceFooterNotesUpdated');
  return note;
};

export const updateInvoiceFooterNote = async (
  id: string,
  data: Omit<InvoiceFooterNote, 'id'>,
): Promise<InvoiceFooterNote | null> => {
  const snapshot = await ensureSnapshot();
  const updatedNote: InvoiceFooterNote = { ...data, id };
  const nextNotes = snapshot.invoiceFooterNotes
    .map((note) => (note.id === id ? updatedNote : note))
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  await apiPut('/api/data/settings', { invoiceFooterNotes: nextNotes });
  updateSnapshotEntity('invoiceFooterNotes', nextNotes);
  dispatchEvent('invoiceFooterNotesUpdated');
  return updatedNote;
};

export const deleteInvoiceFooterNote = async (id: string): Promise<boolean> => {
  const snapshot = await ensureSnapshot();
  const nextNotes = snapshot.invoiceFooterNotes.filter((note) => note.id !== id);
  await apiPut('/api/data/settings', { invoiceFooterNotes: nextNotes });
  updateSnapshotEntity('invoiceFooterNotes', nextNotes);
  dispatchEvent('invoiceFooterNotesUpdated');
  return true;
};

export const getApplicableInvoiceFooterText = async (
  invoiceDate: string,
  language: Language,
): Promise<string> => {
  const response = await apiGet<{ text: string }>(
    `/api/data/footer-text?invoiceDate=${encodeURIComponent(invoiceDate)}&language=${language}`,
  );
  return response.text;
};

export const loadInvoiceNumberingSettings = async (): Promise<InvoiceNumberingSettings> => {
  const snapshot = await ensureSnapshot();
  return snapshot.invoiceNumbering;
};

export const loadTenantBranding = async (): Promise<TenantBranding> => {
  const snapshot = await ensureSnapshot();
  return normalizeBranding(snapshot.branding);
};

export const updateTenantBranding = async (
  branding: TenantBranding,
): Promise<TenantBranding | null> => {
  const response = await apiPut<{ branding: TenantBranding } | TenantBranding>('/api/data/settings', {
    branding,
  });
  const nextBranding = normalizeBranding('branding' in response ? response.branding : response);
  updateSnapshotEntity('branding', nextBranding);
  dispatchEvent('tenantBrandingUpdated');
  return nextBranding;
};

export const updateInvoiceNumberingSettings = async (
  settings: InvoiceNumberingSettings,
): Promise<InvoiceNumberingSettings | null> => {
  const response = await apiPut<{ invoiceNumbering: InvoiceNumberingSettings } | InvoiceNumberingSettings>(
    '/api/data/settings',
    {
      invoiceNumbering: settings,
    },
  );
  const invoiceNumbering =
    'invoiceNumbering' in response ? response.invoiceNumbering : response;
  updateSnapshotEntity('invoiceNumbering', invoiceNumbering);
  dispatchEvent('invoiceNumberingUpdated');
  return invoiceNumbering;
};

export const reserveNextInvoiceNumber = async (): Promise<string> => {
  const response = await apiPost<{ invoiceNumber: string }>('/api/data/reserve-invoice-number');
  const snapshot = await ensureSnapshot();
  const currentNextNumber = snapshot.invoiceNumbering.nextNumber ?? snapshot.invoiceNumbering.startNumber;
  updateSnapshotEntity('invoiceNumbering', {
    ...snapshot.invoiceNumbering,
    nextNumber: currentNextNumber + 1,
  });
  dispatchEvent('invoiceNumberingUpdated');
  return response.invoiceNumber;
};

export const getNextInvoiceNumber = async (): Promise<string> => {
  const response = await apiGet<{ invoiceNumber: string }>('/api/data/next-invoice-number');
  return response.invoiceNumber;
};

export const getAvailableCoursesForInvoicing = async (clientId?: string): Promise<Course[]> => {
  const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
  return apiGet<Course[]>(`/api/data/available-courses${query}`);
};

export const loadBlackouts = async (): Promise<Blackout[]> => {
  const snapshot = await ensureSnapshot();
  return [...snapshot.blackouts];
};

export const addBlackout = async (data: Omit<Blackout, 'id'>): Promise<Blackout | null> => {
  const blackout: Blackout = { ...data, id: generateId('blackout') };
  const created = await postEntity('blackouts', blackout, 'blackoutUpdated');
  if (created) {
    const snapshot = await ensureSnapshot();
    updateSnapshotEntity('blackouts', [...snapshot.blackouts.filter((entry) => entry.id !== created.id), created]);
  }
  return created;
};

export const deleteBlackout = async (blackoutId: string): Promise<boolean> => {
  const response = await apiDelete<{ success?: boolean }>(`/api/data/blackouts/${blackoutId}`);
  const success = Boolean(response.success);
  if (success) {
    const snapshot = await ensureSnapshot();
    updateSnapshotEntity(
      'blackouts',
      snapshot.blackouts.filter((blackout) => blackout.id !== blackoutId),
    );
    dispatchEvent('blackoutUpdated');
  }
  return success;
};

export const updateBlackout = async (
  blackoutId: string,
  data: Omit<Blackout, 'id'>,
): Promise<Blackout | null> => {
  const updated = await putEntity('blackouts', blackoutId, { ...data, id: blackoutId }, 'blackoutUpdated');
  if (updated) {
    const snapshot = await ensureSnapshot();
    updateSnapshotEntity(
      'blackouts',
      snapshot.blackouts.map((blackout) => (blackout.id === blackoutId ? updated : blackout)),
    );
  }
  return updated;
};

export const initializeAutoSync = (): void => {};

export const exportAllData = async (): Promise<string> => {
  const snapshot = await refreshSnapshot();
  return JSON.stringify(snapshot, null, 2);
};

export const createBlankRemoteJson = async (): Promise<boolean> => {
  const response = await apiPost<{ success: boolean }>('/api/admin/clear');
  snapshotCache = defaultSnapshot();
  dispatchEvent('azureSyncSuccess');
  return response.success;
};

export const syncWithAzure = async (): Promise<{ success: boolean; message: string }> => {
  try {
    await refreshSnapshot();
    return { success: true, message: 'Datos del tenant sincronizados con Azure SQL.' };
  } catch {
    return { success: false, message: 'No se pudo sincronizar el tenant actual.' };
  }
};

export const clearExampleData = (): void => {};

export const validateInvoiceUpdate = async (
  invoiceId: string,
  expectedData: Partial<InvoiceFromCourse>,
): Promise<boolean> => {
  const response = await apiPost<{ ok: boolean }>(`/api/admin/validate-invoice/${invoiceId}`, expectedData);
  return response.ok;
};

export const clearAllData = async (): Promise<boolean> => {
  const response = await apiPost<{ success: boolean }>('/api/admin/clear');
  snapshotCache = defaultSnapshot();
  dispatchEvent('azureSyncSuccess');
  return response.success;
};

export const diagnoseInvoiceIssues = async (invoiceId: string): Promise<void> => {
  const invoice = await getInvoiceById(invoiceId);
  console.log('Diagnóstico de factura:', invoice);
};
