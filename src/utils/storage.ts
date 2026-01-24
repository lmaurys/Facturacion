import { Course, Client, InvoiceFromCourse, Blackout, Instructor, Item, IssuerProfile, TransferOptionProfile, Currency, InvoiceNumberingSettings, InvoiceFooterNote, Language } from '../types';
import { loadDataFromAzure, saveDataToAzure } from './azureBlobSync';
import { getAzureBlobConfig, setAzureBlobConfig } from './azureBlobConfig';

const defaultInvoiceNumberingSettings: InvoiceNumberingSettings = {
  prefix: '',
  startNumber: 1,
  nextNumber: 1
};

const normalizeInvoiceNumberingSettings = (raw: unknown): InvoiceNumberingSettings => {
  const obj = (raw || {}) as Partial<InvoiceNumberingSettings>;
  const prefix = (typeof obj.prefix === 'string' ? obj.prefix : defaultInvoiceNumberingSettings.prefix).trim();
  const startNumberRaw = (obj as any).startNumber;
  const startNumberNum = typeof startNumberRaw === 'number' ? startNumberRaw : Number(startNumberRaw);
  const startNumber = Number.isFinite(startNumberNum) && startNumberNum >= 1
    ? Math.floor(startNumberNum)
    : defaultInvoiceNumberingSettings.startNumber;

  const nextNumberRaw = (obj as any).nextNumber;
  const nextNumberNum = typeof nextNumberRaw === 'number' ? nextNumberRaw : Number(nextNumberRaw);
  const nextNumber = Number.isFinite(nextNumberNum) && nextNumberNum >= 1
    ? Math.floor(nextNumberNum)
    : startNumber;
  return {
    prefix: prefix || defaultInvoiceNumberingSettings.prefix,
    startNumber,
    nextNumber
  };
};

const normalizeDateYYYYMMDD = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fallback;
};

const normalizeInvoiceFooterNotes = (raw: unknown): InvoiceFooterNote[] => {
  const arr = Array.isArray(raw) ? raw : [];
  const normalized = arr
    .map((n: any, idx: number) => {
      const id = typeof n?.id === 'string' && n.id.trim() ? n.id.trim() : `footer_${Date.now()}_${idx}`;
      const effectiveFrom = normalizeDateYYYYMMDD(n?.effectiveFrom, '1970-01-01');
      const es = typeof n?.es === 'string' ? n.es : '';
      const en = typeof n?.en === 'string' ? n.en : '';
      return { id, effectiveFrom, es, en } as InvoiceFooterNote;
    })
    .filter(n => (n.es || n.en) && n.effectiveFrom);

  if (normalized.length === 0) return [];

  // Orden ascendente por fecha
  normalized.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  return normalized;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Azure como única fuente de verdad
let localDataCache: {
  courses: Course[];
  clients: Client[];
  invoices: InvoiceFromCourse[];
  instructors: Instructor[];
  blackouts: Blackout[];
  issuerProfiles: IssuerProfile[];
  transferOptions: TransferOptionProfile[];
  invoiceNumbering: InvoiceNumberingSettings;
  invoiceFooterNotes: InvoiceFooterNote[];
  lastUpdate: string;
  isInitialized: boolean;
} = {
  courses: [],
  clients: [],
  invoices: [],
  instructors: [],
  blackouts: [],
  issuerProfiles: [],
  transferOptions: [],
  invoiceNumbering: { ...defaultInvoiceNumberingSettings },
  invoiceFooterNotes: [],
  lastUpdate: new Date().toISOString(),
  isInitialized: false
};

type ProtectedSectionKey = 'issuerProfiles' | 'transferOptions' | 'invoiceNumbering' | 'invoiceFooterNotes';

// Para evitar pérdida de datos: solo sobreescribimos estas secciones si fueron editadas en esta sesión.
let hasLoadedRemoteOnce = false;
const dirtyProtectedSections: Record<ProtectedSectionKey, boolean> = {
  issuerProfiles: false,
  transferOptions: false,
  invoiceNumbering: false,
  invoiceFooterNotes: false
};

const markProtectedSectionDirty = (key: ProtectedSectionKey): void => {
  dirtyProtectedSections[key] = true;
};

const resetProtectedSectionDirtyFlags = (): void => {
  (Object.keys(dirtyProtectedSections) as ProtectedSectionKey[]).forEach((k) => {
    dirtyProtectedSections[k] = false;
  });
};

const buildDataToSync = async (): Promise<{
  courses: Course[];
  clients: Client[];
  invoices: InvoiceFromCourse[];
  azureBlobConfig?: any;
  instructors: Instructor[];
  blackouts: Blackout[];
  issuerProfiles: IssuerProfile[];
  transferOptions: TransferOptionProfile[];
  invoiceNumbering: InvoiceNumberingSettings;
  invoiceFooterNotes: InvoiceFooterNote[];
  exportDate: string;
  version: number;
} | null> => {
  const azureBlobConfig = getAzureBlobConfig() ?? undefined;

  // Intentar leer el remoto para preservar secciones protegidas cuando NO fueron tocadas.
  // Si nunca se logró leer remoto y ahora tampoco se puede, abortamos para no sobrescribir y perder datos.
  let remote: any | null = null;
  try {
    remote = await loadDataFromAzure();
  } catch {
    remote = null;
  }

  if (!remote && !hasLoadedRemoteOnce) {
    console.warn('⚠️ No se pudo leer el JSON remoto (y nunca se ha leído antes). Se cancela el guardado para evitar pérdida de issuerProfiles/invoiceNumbering/invoiceFooterNotes.');
    return null;
  }

  const remoteIssuerProfiles = ((remote as any)?.issuerProfiles || (remote as any)?.issuers) as unknown;
  const remoteTransferOptions = ((remote as any)?.transferOptions || (remote as any)?.transferOptionProfiles) as unknown;
  const remoteInvoiceNumbering = (remote as any)?.invoiceNumbering as unknown;
  const remoteInvoiceFooterNotes = (remote as any)?.invoiceFooterNotes as unknown;

  const issuerProfiles = dirtyProtectedSections.issuerProfiles
    ? localDataCache.issuerProfiles
    : (Array.isArray(remoteIssuerProfiles) ? (remoteIssuerProfiles as IssuerProfile[]) : localDataCache.issuerProfiles);

  const transferOptions = dirtyProtectedSections.transferOptions
    ? localDataCache.transferOptions
    : (Array.isArray(remoteTransferOptions) ? (remoteTransferOptions as TransferOptionProfile[]) : localDataCache.transferOptions);

  const invoiceNumbering = dirtyProtectedSections.invoiceNumbering
    ? normalizeInvoiceNumberingSettings(localDataCache.invoiceNumbering)
    : normalizeInvoiceNumberingSettings(remoteInvoiceNumbering ?? localDataCache.invoiceNumbering);

  const invoiceFooterNotes = dirtyProtectedSections.invoiceFooterNotes
    ? normalizeInvoiceFooterNotes(localDataCache.invoiceFooterNotes)
    : normalizeInvoiceFooterNotes(remoteInvoiceFooterNotes ?? localDataCache.invoiceFooterNotes);

  return {
    courses: localDataCache.courses,
    clients: localDataCache.clients,
    invoices: localDataCache.invoices,
    azureBlobConfig,
    instructors: localDataCache.instructors,
    blackouts: localDataCache.blackouts,
    issuerProfiles,
    transferOptions,
    invoiceNumbering,
    invoiceFooterNotes,
    exportDate: new Date().toISOString(),
    version: 3
  };
};

// Eventos para notificar a la UI
const dispatchSyncEvent = (type: 'start' | 'success' | 'error') => {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(`azureSync${type.charAt(0).toUpperCase() + type.slice(1)}`));
    }
};

// Función para forzar el guardado inmediato
export const forceSaveToAzure = async (): Promise<boolean> => {
  try {
    console.log('🚨 FORZANDO GUARDADO INMEDIATO A AZURE...');

    const dataToSync = await buildDataToSync();
    if (!dataToSync) {
      console.log('❌ Guardado cancelado para evitar pérdida de datos protegidos');
      return false;
    }

    console.log('📊 Datos a guardar forzadamente:', {
      coursesCount: dataToSync.courses.length,
      clientsCount: dataToSync.clients.length,
      invoicesCount: dataToSync.invoices.length
    });

    const success = await saveDataToAzure(dataToSync);
    
    if (success) {
      localDataCache.lastUpdate = new Date().toISOString();
      resetProtectedSectionDirtyFlags();
      console.log('✅ GUARDADO FORZADO EXITOSO');
      return true;
    } else {
      console.log('❌ GUARDADO FORZADO FALLÓ');
      return false;
    }
  } catch (error) {
    console.error('❌ Error en guardado forzado:', error);
    return false;
  }
};

// Función mejorada para sincronizar automáticamente después de cada cambio
const autoSyncAfterChange = async () => {
  try {
    console.log('🔄 Starting auto sync after change...');
    console.log('📊 Cache local antes de sync:', {
      courses: localDataCache.courses.length,
      clients: localDataCache.clients.length,
      invoices: localDataCache.invoices.length,
      isInitialized: localDataCache.isInitialized
    });
    
    // Si no está inicializado, forzar inicialización
    if (!localDataCache.isInitialized) {
      console.log('⚠️ Cache no inicializado, ejecutando inicialización...');
      await initializeFromAzure();
    }
    
    dispatchSyncEvent('start');
    
    // Intentar guardado normal
    const success = await forceSaveToAzure();
    
    if (success) {
      dispatchSyncEvent('success');
      console.log('✅ Sincronización automática exitosa');
    } else {
      console.log('❌ Sincronización automática falló, intentando método alternativo...');
      // Intentar método alternativo
      const { saveDataToAzure } = await import('./azureBlobSync');
      const dataToSync = await buildDataToSync();
      const altSuccess = dataToSync ? await saveDataToAzure(dataToSync) : false;
      
      if (altSuccess) {
        dispatchSyncEvent('success');
        resetProtectedSectionDirtyFlags();
        console.log('✅ Sincronización alternativa exitosa');
      } else {
        dispatchSyncEvent('error');
        console.log('❌ Todas las sincronizaciones fallaron');
      }
    }
  } catch (error) {
    dispatchSyncEvent('error');
    console.error('❌ Error en sincronización automática:', error);
  }
};

// Debug del estado del cache
export const debugCacheState = (): void => {
  console.log('🐛 DEBUG: Estado del cache local');
  debugCompleteSystem();
  
  // Información adicional para debugging
  console.log('🔍 INFORMACIÓN ADICIONAL:');
  console.log('  - Timestamp actual:', new Date().toISOString());
  console.log('  - Diferencia de tiempo desde última actualización:', 
    localDataCache.lastUpdate ? 
      Math.round((new Date().getTime() - new Date(localDataCache.lastUpdate).getTime()) / 1000 / 60) + ' minutos' : 
      'No disponible'
  );
};

// DEBUG COMPLETO DEL SISTEMA
export const debugCompleteSystem = (): void => {
  console.log('🔍 ============= DEBUG COMPLETO DEL SISTEMA =============');
  console.log('📍 ESTADO DEL CACHE LOCAL:');
  console.log('  - isInitialized:', localDataCache.isInitialized);
  console.log('  - courses.length:', localDataCache.courses.length);
  console.log('  - clients.length:', localDataCache.clients.length);
  console.log('  - invoices.length:', localDataCache.invoices.length);
  console.log('  - lastUpdate:', localDataCache.lastUpdate);
  
  console.log('📍 PRIMEROS DATOS EN CACHE:');
  if (localDataCache.courses.length > 0) {
    console.log('🎓 Primeros 3 cursos:');
    localDataCache.courses.slice(0, 3).forEach((course, index) => {
      console.log(`  ${index + 1}. ${course.courseName} (${course.id}) - Cliente: ${course.clientId}`);
    });
  } else {
    console.log('🎓 No hay cursos en el cache');
  }
  
  if (localDataCache.clients.length > 0) {
    console.log('👥 Primeros 3 clientes:');
    localDataCache.clients.slice(0, 3).forEach((client, index) => {
      console.log(`  ${index + 1}. ${client.name} (${client.id}) - NIT: ${client.nit}`);
    });
  } else {
    console.log('👥 No hay clientes en el cache');
  }
  
  console.log('📍 ESTRUCTURA COMPLETA DEL CACHE:');
  console.log('Cache completo:', localDataCache);
  
  console.log('🔍 ============= FIN DEBUG COMPLETO =============');
};

// Función para eliminar duplicados de clientes
const removeDuplicateClients = (clients: Client[]): Client[] => {
  console.log('🧹 Iniciando limpieza de duplicados de clientes');
  console.log('📊 Clientes antes de limpieza:', clients.length);
  
  const uniqueClients = clients.filter((client, index, self) => {
    const isDuplicate = self.findIndex(c => 
      c.id === client.id || 
      (c.nit === client.nit && c.nit !== '') ||
      (c.name === client.name && c.name !== '')
    ) !== index;
    
    if (isDuplicate) {
      console.log('🔍 Cliente duplicado encontrado y eliminado:', {
        id: client.id,
        name: client.name,
        nit: client.nit
      });
    }
    
    return !isDuplicate;
  });
  
  console.log('📊 Clientes después de limpieza:', uniqueClients.length);
  console.log('📋 Clientes únicos:', uniqueClients.map(c => ({ id: c.id, name: c.name, nit: c.nit })));
  
  return uniqueClients;
};

// Función para eliminar duplicados de cursos
const removeDuplicateCourses = (courses: Course[]): Course[] => {
  console.log('🧹 Iniciando limpieza de duplicados de cursos');
  console.log('📊 Cursos antes de limpieza:', courses.length);
  
  const uniqueCourses = courses.filter((course, index, self) => {
    const isDuplicate = self.findIndex(c => c.id === course.id) !== index;
    
    if (isDuplicate) {
      console.log('🔍 Curso duplicado encontrado y eliminado:', {
        id: course.id,
        name: course.courseName,
        startDate: course.startDate
      });
    }
    
    return !isDuplicate;
  });
  
  console.log('📊 Cursos después de limpieza:', uniqueCourses.length);
  console.log('📋 Cursos únicos:', uniqueCourses.slice(0, 3).map(c => ({ id: c.id, name: c.courseName, startDate: c.startDate })));
  
  return uniqueCourses;
};

// Función para eliminar duplicados de facturas
const removeDuplicateInvoices = (invoices: InvoiceFromCourse[]): InvoiceFromCourse[] => {
  console.log('🧹 Iniciando limpieza de duplicados de facturas');
  console.log('📊 Facturas antes de limpieza:', invoices.length);
  
  const uniqueInvoices = invoices.filter((invoice, index, self) => {
    const isDuplicate = self.findIndex(i => 
      i.id === invoice.id || 
      (i.invoiceNumber === invoice.invoiceNumber && i.invoiceNumber !== '')
    ) !== index;
    
    if (isDuplicate) {
      console.log('🔍 Factura duplicada encontrada y eliminada:', {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber
      });
    }
    
    return !isDuplicate;
  });
  
  console.log('📊 Facturas después de limpieza:', uniqueInvoices.length);
  
  return uniqueInvoices;
};

const normalizeInvoiceItem = (item: Item): Item => {
  return {
    description: item.description?.trim() ?? '',
    quantity: typeof item.quantity === 'number' ? item.quantity : Number(item.quantity) || 0,
    unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : Number(item.unitPrice) || 0
  };
};

const normalizeInvoiceRecord = (invoice: InvoiceFromCourse): InvoiceFromCourse => {
  const raw = invoice as unknown as any;
  const normalizedItems = Array.isArray(invoice.items)
    ? invoice.items.map(normalizeInvoiceItem)
    : [];

  return {
    ...raw,
    courseIds: Array.isArray(raw.courseIds) ? raw.courseIds : [],
    items: normalizedItems,
    currency: (raw.currency || 'USD') as Currency,
    issuerId: (raw.issuerId || raw.issuer || '') as string,
    transferOptionId: (raw.transferOptionId || raw.transferOption || '') as string
  } as InvoiceFromCourse;
};

// Cargar datos iniciales desde Azure
export const initializeFromAzure = async (): Promise<boolean> => {
  try {
    console.log('🔄 Cargando datos iniciales desde Azure...');
    console.log('📍 PASO 1: Iniciando carga desde Azure');
    dispatchSyncEvent('start');
    
    let azureData = await loadDataFromAzure();
    
  if (azureData) {
      // Aprender la config de conexión desde el mismo JSON remoto (cross-device)
      try {
        const maybeCfg = (azureData as any).azureBlobConfig as
          | { publicUrl?: string; blobUrlWithSas?: string }
          | undefined;
        if (maybeCfg && (maybeCfg.publicUrl || maybeCfg.blobUrlWithSas)) {
          setAzureBlobConfig({
            publicUrl: maybeCfg.publicUrl,
            blobUrlWithSas: maybeCfg.blobUrlWithSas
          });
        }
      } catch {
        // noop
      }

      console.log('📍 PASO 2: Datos recibidos desde Azure');
      console.log('📊 DATOS BRUTOS RECIBIDOS DE AZURE:', {
        courses: azureData.courses?.length || 0,
        clients: azureData.clients?.length || 0,
        invoices: azureData.invoices?.length || 0,
        exportDate: azureData.exportDate,
        version: azureData.version
      });
      
      // Mostrar algunos datos para debug
    if (azureData.courses && (azureData.courses as unknown[]).length > 0) {
        console.log('🎓 MUESTRA DE CURSOS EN AZURE:', 
      (azureData.courses as Partial<Course>[]).slice(0, 3).map((c) => ({
            id: c.id,
            name: c.courseName,
            startDate: c.startDate,
            clientId: c.clientId,
            status: c.status
          }))
        );
      } else {
        console.log('⚠️ No hay cursos en los datos de Azure');
      }
      
    if (azureData.clients && (azureData.clients as unknown[]).length > 0) {
        console.log('👥 MUESTRA DE CLIENTES EN AZURE:', 
      (azureData.clients as Partial<Client>[]).slice(0, 3).map((c) => ({
            id: c.id,
            name: c.name,
            nit: c.nit
          }))
        );
      } else {
        console.log('⚠️ No hay clientes en los datos de Azure');
      }
      
      // Limpiar duplicados antes de cargar
      console.log('📍 PASO 3: Iniciando limpieza de duplicados');
      console.log('🧹 Limpiando duplicados antes de cargar...');
      
  const remoteClients = (azureData.clients || []) as unknown as Client[];
      const uniqueClients = removeDuplicateClients(remoteClients || []);
      console.log('📍 PASO 3A: Clientes después de limpieza:', uniqueClients.length);
      
  const remoteCourses = (azureData.courses || []) as unknown as Course[];
  const uniqueCoursesRaw = removeDuplicateCourses(remoteCourses || []);
  console.log('📍 PASO 3B: Cursos después de limpieza:', uniqueCoursesRaw.length);
      
  const remoteInvoices = (azureData.invoices || []) as unknown as InvoiceFromCourse[];
  const uniqueInvoicesRaw = removeDuplicateInvoices(remoteInvoices || []);
  const normalizedInvoices = uniqueInvoicesRaw.map(normalizeInvoiceRecord);
  console.log('📍 PASO 3C: Facturas después de limpieza:', normalizedInvoices.length);
      
      console.log('📊 DATOS DESPUÉS DE LIMPIAR DUPLICADOS:', {
        courses: uniqueCoursesRaw.length,
        clients: uniqueClients.length,
  invoices: normalizedInvoices.length
      });
      
      console.log('📍 PASO 4: Actualizando cache local');
      // Instructores (sin backfill con datos hardcodeados)
      const instructors: Instructor[] = ((azureData as { instructors?: Instructor[] }).instructors || []) as Instructor[];

      const coursesWithInstructor: Course[] = (uniqueCoursesRaw as Course[]).map((c: Course) => ({
        ...c,
        currency: (c.currency || 'USD') as Currency
      }));

      const issuerProfiles = (((azureData as any).issuerProfiles || (azureData as any).issuers) as IssuerProfile[] | undefined);
      const transferOptions = (((azureData as any).transferOptions || (azureData as any).transferOptionProfiles) as TransferOptionProfile[] | undefined);
      const invoiceNumbering = normalizeInvoiceNumberingSettings((azureData as any).invoiceNumbering);
      const invoiceFooterNotes = normalizeInvoiceFooterNotes((azureData as any).invoiceFooterNotes);

      localDataCache = {
        courses: coursesWithInstructor,
        clients: uniqueClients,
        invoices: normalizedInvoices,
        instructors,
        blackouts: ((azureData as { blackouts?: Blackout[] }).blackouts || []),
        issuerProfiles: Array.isArray(issuerProfiles) ? issuerProfiles : [],
        transferOptions: Array.isArray(transferOptions) ? transferOptions : [],
        invoiceNumbering,
        invoiceFooterNotes,
        lastUpdate: azureData.exportDate || new Date().toISOString(),
        isInitialized: true
      };

      hasLoadedRemoteOnce = true;
      
      console.log('📍 PASO 5: Cache actualizado');
      dispatchSyncEvent('success');
      console.log('✅ CACHE LOCAL ACTUALIZADO:', {
        courses: localDataCache.courses.length,
        clients: localDataCache.clients.length,
        invoices: localDataCache.invoices.length,
        lastUpdate: localDataCache.lastUpdate
      });
      
      // Verificar que los datos realmente estén en el cache
      console.log('📍 PASO 6: Verificando cache después de actualización');
      console.log('🔍 Primer curso en cache:', localDataCache.courses[0] || 'No hay cursos');
      console.log('🔍 Primer cliente en cache:', localDataCache.clients[0] || 'No hay clientes');
      
      return true;
    } else {
      console.log('📍 PASO 2: No se recibieron datos de Azure');
      // Si Azure falla, NO cargar datos de ejemplo - iniciar vacío
      console.log('⚠️ Azure no disponible, iniciando con estructura vacía (sin datos de ejemplo)');
      
      localDataCache = {
        courses: [],
        clients: [],
        invoices: [],
        instructors: [],
        blackouts: [],
        issuerProfiles: [],
        transferOptions: [],
        invoiceNumbering: { ...defaultInvoiceNumberingSettings },
        invoiceFooterNotes: [],
        lastUpdate: new Date().toISOString(),
        isInitialized: true
      };
      
      console.log('✅ Sistema inicializado vacío - sin datos inventados');
      dispatchSyncEvent('success');
      return true;
    }
  } catch (error) {
    console.log('📍 ERROR en algún paso del proceso');
    dispatchSyncEvent('error');
    console.error('❌ Error cargando datos iniciales:', error);
    
    // Asegurar que siempre haya una estructura válida pero VACÍA
    localDataCache = {
      courses: [],
      clients: [],
      invoices: [],
      instructors: [],
      blackouts: [],
      issuerProfiles: [],
      transferOptions: [],
      invoiceNumbering: { ...defaultInvoiceNumberingSettings },
      invoiceFooterNotes: [],
      lastUpdate: new Date().toISOString(),
      isInitialized: true
    };
    
    console.log('✅ Estructura vacía creada - sin datos inventados por error');
    return false;
  }
};

// FUNCIÓN DE EMERGENCIA - CARGAR TODOS LOS DATOS SIN FILTROS
export const emergencyLoadFromAzure = async (): Promise<boolean> => {
  try {
    console.log('🚨 CARGA DE EMERGENCIA desde Azure...');
    
    const azureData = await loadDataFromAzure();
    
    if (azureData) {
      // NO limpiar duplicados - cargar TODO
      // Cargar TODO tal cual pero garantizando tipos y backfill de instructor
      const courses = ((azureData.courses || []) as unknown as Course[]).map((c) => ({
        ...c,
        currency: (c.currency || 'USD') as Currency
      }));
      const clients = (azureData.clients || []) as unknown as Client[];
      const invoices = ((azureData.invoices || []) as unknown as InvoiceFromCourse[]).map(normalizeInvoiceRecord);
      const instructors = ((azureData as { instructors?: Instructor[] }).instructors || []) as Instructor[];
      const issuerProfiles = (((azureData as any).issuerProfiles || (azureData as any).issuers) as IssuerProfile[] | undefined);
      const transferOptions = (((azureData as any).transferOptions || (azureData as any).transferOptionProfiles) as TransferOptionProfile[] | undefined);
      const invoiceNumbering = normalizeInvoiceNumberingSettings((azureData as any).invoiceNumbering);
      const invoiceFooterNotes = normalizeInvoiceFooterNotes((azureData as any).invoiceFooterNotes);
      localDataCache = {
        courses,
        clients,
        invoices,
        instructors,
        blackouts: ((azureData as { blackouts?: Blackout[] }).blackouts || []),
        issuerProfiles: Array.isArray(issuerProfiles) ? issuerProfiles : [],
        transferOptions: Array.isArray(transferOptions) ? transferOptions : [],
        invoiceNumbering,
        invoiceFooterNotes,
        lastUpdate: azureData.exportDate || new Date().toISOString(),
        isInitialized: true
      };

      hasLoadedRemoteOnce = true;
      
      console.log('🚨 DATOS DE EMERGENCIA CARGADOS:', {
        courses: localDataCache.courses.length,
        clients: localDataCache.clients.length,
        invoices: localDataCache.invoices.length
      });
      
      // Disparar evento de éxito
      dispatchSyncEvent('success');
      
      return true;
    } else {
      console.error('❌ No se pudieron cargar datos de Azure');
      return false;
    }
  } catch (error) {
    console.error('❌ Error en carga de emergencia:', error);
    return false;
  }
};

// FUNCIÓN ESPECIAL - CARGAR SOLO DATOS REALES DE AZURE (SIN PROCESAMIENTO)
export const loadOnlyRealDataFromAzure = async (): Promise<boolean> => {
  try {
    console.log('🔄 CARGANDO SOLO DATOS REALES DE AZURE...');
    console.log('🚫 Sin datos de ejemplo, sin filtros, sin procesamiento');
    console.log('📍 PASO 1: Iniciando carga especial');
    
    dispatchSyncEvent('start');
    
    const azureData = await loadDataFromAzure();
    
    if (azureData) {
      console.log('📍 PASO 2: Datos recibidos correctamente');
      console.log('📊 DATOS CRUDOS DESDE AZURE (SIN PROCESAMIENTO):', {
        courses: azureData.courses?.length || 0,
        clients: azureData.clients?.length || 0,
        invoices: azureData.invoices?.length || 0,
        exportDate: azureData.exportDate,
        version: azureData.version
      });
      
      // Verificar que los datos no están vacíos
      if (!azureData.courses || azureData.courses.length === 0) {
        console.log('⚠️ WARNING: No hay cursos en los datos de Azure');
      }
      if (!azureData.clients || azureData.clients.length === 0) {
        console.log('⚠️ WARNING: No hay clientes en los datos de Azure');
      }
      
      console.log('📍 PASO 3: Cargando datos exactos (sin filtros)');
      // CARGAR EXACTAMENTE LO QUE ESTÁ EN AZURE - SIN FILTROS (con tipado y backfill mínimo de instructor)
      const rawCourses = (azureData.courses || []) as unknown as Course[];
      let instructors = ((azureData as { instructors?: Instructor[] }).instructors || []) as Instructor[];
      const coursesBackfilled = rawCourses.map(c => ({
        ...c,
        currency: ((c as any).currency || 'USD') as Currency
      }));

      const issuerProfiles = (((azureData as any).issuerProfiles || (azureData as any).issuers) as IssuerProfile[] | undefined);
      const transferOptions = (((azureData as any).transferOptions || (azureData as any).transferOptionProfiles) as TransferOptionProfile[] | undefined);
      const invoiceNumbering = normalizeInvoiceNumberingSettings((azureData as any).invoiceNumbering);
      const invoiceFooterNotes = normalizeInvoiceFooterNotes((azureData as any).invoiceFooterNotes);
      localDataCache = {
        courses: coursesBackfilled,
        clients: (azureData.clients || []) as unknown as Client[],
        invoices: ((azureData.invoices || []) as unknown as InvoiceFromCourse[]).map(normalizeInvoiceRecord),
        instructors,
        blackouts: ((azureData as { blackouts?: Blackout[] }).blackouts || []),
        issuerProfiles: Array.isArray(issuerProfiles) ? issuerProfiles : [],
        transferOptions: Array.isArray(transferOptions) ? transferOptions : [],
        invoiceNumbering,
        invoiceFooterNotes,
        lastUpdate: azureData.exportDate || new Date().toISOString(),
        isInitialized: true
      };

      hasLoadedRemoteOnce = true;
      
      console.log('📍 PASO 4: Cache actualizado con datos crudos');
      dispatchSyncEvent('success');
      console.log('✅ DATOS REALES CARGADOS (SIN FILTROS):', {
        courses: localDataCache.courses.length,
        clients: localDataCache.clients.length,
        invoices: localDataCache.invoices.length,
        lastUpdate: localDataCache.lastUpdate
      });
      
      // Mostrar algunos datos para verificar
      if (localDataCache.courses.length > 0) {
        console.log('🎓 PRIMEROS CURSOS CARGADOS:', 
          localDataCache.courses.slice(0, 3).map(c => ({
            id: c.id,
            name: c.courseName,
            date: c.startDate,
            client: c.clientId
          }))
        );
      } else {
        console.log('❌ No se cargaron cursos al cache');
      }
      
      if (localDataCache.clients.length > 0) {
        console.log('👥 PRIMEROS CLIENTES CARGADOS:', 
          localDataCache.clients.slice(0, 3).map(c => ({
            id: c.id,
            name: c.name,
            nit: c.nit
          }))
        );
      } else {
        console.log('❌ No se cargaron clientes al cache');
      }
      
      console.log('📍 PASO 5: Verificación final del cache');
      console.log('🔍 Cache después de carga:', {
        isInitialized: localDataCache.isInitialized,
        coursesCount: localDataCache.courses.length,
        clientsCount: localDataCache.clients.length
      });
      
      return true;
    } else {
      console.log('📍 PASO 2: No se recibieron datos de Azure');
      console.log('❌ No se pudieron obtener datos desde Azure');
      
      // Estructura vacía - SIN DATOS DE EJEMPLO
      localDataCache = {
        courses: [],
        clients: [],
        invoices: [],
        instructors: [],
        blackouts: [],
        issuerProfiles: [],
        transferOptions: [],
        invoiceNumbering: { ...defaultInvoiceNumberingSettings },
        invoiceFooterNotes: [],
        lastUpdate: new Date().toISOString(),
        isInitialized: true
      };
      
      dispatchSyncEvent('success');
      return false;
    }
  } catch (error) {
    console.log('📍 ERROR en carga especial');
    dispatchSyncEvent('error');
    console.error('❌ Error cargando datos reales desde Azure:', error);
    
    // Estructura vacía - SIN DATOS DE EJEMPLO
    localDataCache = {
      courses: [],
      clients: [],
      invoices: [],
      instructors: [],
      blackouts: [],
      issuerProfiles: [],
      transferOptions: [],
      invoiceNumbering: { ...defaultInvoiceNumberingSettings },
      invoiceFooterNotes: [],
      lastUpdate: new Date().toISOString(),
      isInitialized: true
    };
    
    return false;
  }
};

// ========================= COURSES =========================

export const loadCourses = async (): Promise<Course[]> => {
  console.log('📚 Función loadCourses llamada');
  console.log('📍 VERIFICANDO ESTADO DEL CACHE:');
  console.log('  - isInitialized:', localDataCache.isInitialized);
  console.log('  - courses.length:', localDataCache.courses.length);
  console.log('  - clients.length:', localDataCache.clients.length);
  console.log('  - invoices.length:', localDataCache.invoices.length);
  console.log('  - lastUpdate:', localDataCache.lastUpdate);
  
  if (localDataCache.courses.length > 0) {
    console.log('✅ Cache tiene cursos, retornando desde cache local');
    console.log('📋 Primeros 3 cursos en cache:', 
      localDataCache.courses.slice(0, 3).map(c => ({ 
        id: c.id, 
        name: c.courseName,
        startDate: c.startDate,
        clientId: c.clientId 
      }))
    );
    return localDataCache.courses;
  } else {
    console.log('⚠️ Cache local está vacío');
    console.log('📍 Verificando si el sistema está inicializado...');
    
    if (!localDataCache.isInitialized) {
      console.log('🔄 Sistema no inicializado, intentando inicializar desde Azure...');
      const initSuccess = await initializeFromAzure();
      console.log('📍 Resultado de inicialización:', initSuccess);
      
      if (initSuccess && localDataCache.courses.length > 0) {
        console.log('✅ Inicialización exitosa, retornando cursos cargados');
        return localDataCache.courses;
      } else {
        console.log('❌ Inicialización no cargó cursos');
      }
    } else {
      console.log('✅ Sistema ya inicializado, pero cache vacío');
    }
    
    console.log('🔄 Retornando array vacío');
    return [];
  }
};

export const addCourse = async (courseData: Omit<Course, 'id'>): Promise<Course | null> => {
  try {
    console.log('🔄 Intentando agregar curso:', courseData.courseName);
    console.log('📊 Estado actual del cache:', {
      courses: localDataCache.courses.length,
      clients: localDataCache.clients.length,
      invoices: localDataCache.invoices.length,
      isInitialized: localDataCache.isInitialized
    });
    
    // Verificar inicialización
    if (!localDataCache.isInitialized) {
      console.log('⚠️ Cache no inicializado, forzando inicialización...');
      await initializeFromAzure();
    }
    
    const newCourse: Course = {
      ...courseData,
      id: generateCourseId()
    };
    
    console.log('🆕 Nuevo curso creado:', newCourse.id);
    
    localDataCache.courses.push(newCourse);
    
    console.log('📈 Cursos después de agregar:', localDataCache.courses.length);
    
    // FORZAR GUARDADO INMEDIATO
    console.log('🚨 FORZANDO GUARDADO INMEDIATO DEL CURSO...');
    const saveSuccess = await forceSaveToAzure();
    
    if (saveSuccess) {
      console.log('✅ Curso agregado y guardado exitosamente:', newCourse.id);
      // Disparar evento de actualización
      window.dispatchEvent(new CustomEvent('courseUpdated'));
      return newCourse;
    } else {
      console.log('❌ Error guardando curso, pero manteniéndolo en cache local');
      // Mantener en cache local aunque Azure falle
      // Disparar evento de actualización
      window.dispatchEvent(new CustomEvent('courseUpdated'));
      return newCourse;
    }
  } catch (error) {
    console.error('❌ Error adding course:', error);
    return null;
  }
};

export const updateCourse = async (courseId: string, courseData: Omit<Course, 'id'>): Promise<Course | null> => {
  try {
    console.log('🔄 Actualizando curso:', courseId);
    
    // Verificar inicialización
    if (!localDataCache.isInitialized) {
      console.log('⚠️ Cache no inicializado, forzando inicialización...');
      await initializeFromAzure();
    }
    
    const courseIndex = localDataCache.courses.findIndex(course => course.id === courseId);
    
    if (courseIndex === -1) {
      console.log('❌ Curso no encontrado:', courseId);
      return null;
    }
    
    const updatedCourse: Course = {
      ...localDataCache.courses[courseIndex],
      ...courseData,
      id: courseId
    };
    
    localDataCache.courses[courseIndex] = updatedCourse;
    
    console.log('📝 Curso actualizado en cache local');
    
    // FORZAR GUARDADO INMEDIATO
    console.log('🚨 FORZANDO GUARDADO INMEDIATO DEL CURSO ACTUALIZADO...');
    const saveSuccess = await forceSaveToAzure();
    
    if (saveSuccess) {
      console.log('✅ Curso actualizado y guardado exitosamente:', courseId);
    } else {
      console.log('❌ Error guardando curso actualizado, pero manteniéndolo en cache local');
    }
    
    // Disparar evento de actualización
    window.dispatchEvent(new CustomEvent('courseUpdated'));
    return updatedCourse;
  } catch (error) {
    console.error('❌ Error updating course:', error);
    return null;
  }
};

export const deleteCourse = async (courseId: string): Promise<boolean> => {
  try {
    console.log('🔄 Eliminando curso:', courseId);
    
    // Verificar inicialización
    if (!localDataCache.isInitialized) {
      console.log('⚠️ Cache no inicializado, forzando inicialización...');
      await initializeFromAzure();
    }
    
    const initialLength = localDataCache.courses.length;
    localDataCache.courses = localDataCache.courses.filter(course => course.id !== courseId);
    
    if (localDataCache.courses.length === initialLength) {
      console.log('❌ Curso no encontrado para eliminar:', courseId);
      return false; // Course not found
    }
    
    console.log('🗑️ Curso eliminado del cache local');
    
    // FORZAR GUARDADO INMEDIATO
    console.log('🚨 FORZANDO GUARDADO INMEDIATO DESPUÉS DE ELIMINAR CURSO...');
    const saveSuccess = await forceSaveToAzure();
    
    if (saveSuccess) {
      console.log('✅ Curso eliminado y guardado exitosamente:', courseId);
    } else {
      console.log('❌ Error guardando eliminación, pero manteniéndolo eliminado del cache local');
    }
    
    // Disparar evento de actualización
    window.dispatchEvent(new CustomEvent('courseUpdated'));
    return true;
  } catch (error) {
    console.error('❌ Error deleting course:', error);
    return false;
  }
};

export const getCourseById = async (courseId: string): Promise<Course | null> => {
  return localDataCache.courses.find(course => course.id === courseId) || null;
};

// ========================= CLIENTS =========================

export const loadClients = async (): Promise<Client[]> => {
  return localDataCache.clients;
};

export const addClient = async (clientData: Omit<Client, 'id'>): Promise<Client | null> => {
  try {
    console.log('👤 Intentando agregar cliente:', clientData.name);
    
    // Verificar inicialización
    if (!localDataCache.isInitialized) {
      console.log('⚠️ Cache no inicializado, forzando inicialización...');
      await initializeFromAzure();
    }
    
    // Verificar duplicados antes de agregar
    const existingClients = localDataCache.clients;
    const isDuplicate = existingClients.some(client => 
      client.name.toLowerCase().trim() === clientData.name.toLowerCase().trim() ||
      client.nit.replace(/\s+/g, '') === clientData.nit.replace(/\s+/g, '')
    );
    
    if (isDuplicate) {
      console.warn('⚠️ Cliente duplicado detectado:', clientData.name);
      return null;
    }
    
    const newClient: Client = {
      ...clientData,
      id: generateClientId()
    };
    
    console.log('➕ Agregando cliente:', newClient.name);
    localDataCache.clients.push(newClient);
    
    // FORZAR GUARDADO INMEDIATO
    console.log('🚨 FORZANDO GUARDADO INMEDIATO DEL CLIENTE...');
    const saveSuccess = await forceSaveToAzure();
    
    if (saveSuccess) {
      console.log('✅ Cliente agregado y guardado exitosamente:', newClient.id);
    } else {
      console.log('❌ Error guardando cliente, pero manteniéndolo en cache local');
    }
    
    // Disparar evento de actualización
    window.dispatchEvent(new CustomEvent('clientUpdated'));
    return newClient;
  } catch (error) {
    console.error('❌ Error adding client:', error);
    return null;
  }
};

export const updateClient = async (clientId: string, clientData: Omit<Client, 'id'>): Promise<Client | null> => {
  try {
    console.log('👤 Actualizando cliente:', clientId);
    
    // Verificar inicialización
    if (!localDataCache.isInitialized) {
      console.log('⚠️ Cache no inicializado, forzando inicialización...');
      await initializeFromAzure();
    }
    
    const clientIndex = localDataCache.clients.findIndex(client => client.id === clientId);
    
    if (clientIndex === -1) {
      console.log('❌ Cliente no encontrado:', clientId);
      return null;
    }
    
    const updatedClient: Client = {
      ...localDataCache.clients[clientIndex],
      ...clientData,
      id: clientId
    };
    
    localDataCache.clients[clientIndex] = updatedClient;
    
    console.log('📝 Cliente actualizado en cache local');
    
    // FORZAR GUARDADO INMEDIATO
    console.log('🚨 FORZANDO GUARDADO INMEDIATO DEL CLIENTE ACTUALIZADO...');
    const saveSuccess = await forceSaveToAzure();
    
    if (saveSuccess) {
      console.log('✅ Cliente actualizado y guardado exitosamente:', clientId);
    } else {
      console.log('❌ Error guardando cliente actualizado, pero manteniéndolo en cache local');
    }
    
    return updatedClient;
  } catch (error) {
    console.error('❌ Error updating client:', error);
    return null;
  }
};

export const deleteClient = async (clientId: string): Promise<boolean> => {
  try {
    const initialLength = localDataCache.clients.length;
    localDataCache.clients = localDataCache.clients.filter(client => client.id !== clientId);
    
    if (localDataCache.clients.length === initialLength) {
      return false; // Client not found
    }
    
    // Sincronizar automáticamente con Azure
    await autoSyncAfterChange();
    
    return true;
  } catch (error) {
    console.error('Error deleting client:', error);
    return false;
  }
};

export const getClientById = async (clientId: string): Promise<Client | null> => {
  return localDataCache.clients.find(client => client.id === clientId) || null;
};

// ========================= INVOICES =========================

export const loadInvoices = async (): Promise<InvoiceFromCourse[]> => {
  return localDataCache.invoices;
};

export const addInvoice = async (invoiceData: Omit<InvoiceFromCourse, 'id'>): Promise<InvoiceFromCourse | null> => {
  try {
    console.log('🧾 Intentando agregar factura:', invoiceData.invoiceNumber);
    
    // Verificar inicialización
    if (!localDataCache.isInitialized) {
      console.log('⚠️ Cache no inicializado, forzando inicialización...');
      await initializeFromAzure();
    }
    
    const newInvoice: InvoiceFromCourse = normalizeInvoiceRecord({
      ...invoiceData,
      id: generateInvoiceId()
    });
    
    console.log('🆕 Nueva factura creada:', newInvoice.id);
    
  localDataCache.invoices.push(newInvoice);
    
    console.log('📈 Facturas después de agregar:', localDataCache.invoices.length);
    
    // FORZAR GUARDADO INMEDIATO
    console.log('🚨 FORZANDO GUARDADO INMEDIATO DE LA FACTURA...');
    const saveSuccess = await forceSaveToAzure();
    
    if (saveSuccess) {
      console.log('✅ Factura agregada y guardada exitosamente:', newInvoice.id);
    } else {
      console.log('❌ Error guardando factura, pero manteniéndola en cache local');
    }
    
  return newInvoice;
  } catch (error) {
    console.error('❌ Error adding invoice:', error);
    return null;
  }
};

export const updateInvoice = async (invoiceId: string, invoiceData: Omit<InvoiceFromCourse, 'id'>): Promise<InvoiceFromCourse | null> => {
  try {
    console.log('🔄 updateInvoice iniciado:', { invoiceId, invoiceData });
    console.log('📊 Facturas actuales en cache:', localDataCache.invoices.length);
    
    // Verificar inicialización
    if (!localDataCache.isInitialized) {
      console.log('⚠️ Cache no inicializado, forzando inicialización...');
      await initializeFromAzure();
    }
    
    const invoiceIndex = localDataCache.invoices.findIndex(invoice => invoice.id === invoiceId);
    
    console.log('🔍 Índice de factura encontrado:', invoiceIndex);
    
    if (invoiceIndex === -1) {
      console.log('❌ Factura no encontrada con id:', invoiceId);
      return null;
    }
    
    console.log('📋 Factura original:', localDataCache.invoices[invoiceIndex]);
    console.log('🔍 Cambio en emisor:', {
      original: localDataCache.invoices[invoiceIndex].issuerId,
      nuevo: (invoiceData as any).issuerId
    });
    
    const updatedInvoice: InvoiceFromCourse = normalizeInvoiceRecord({
      ...localDataCache.invoices[invoiceIndex],
      ...invoiceData,
      id: invoiceId
    });
    
    console.log('✏️ Factura actualizada a guardar:', updatedInvoice);
    console.log('🔍 Verificando emisor en factura actualizada:', updatedInvoice.issuerId);
    
    // Actualizar en cache local
    localDataCache.invoices[invoiceIndex] = updatedInvoice;
    
    console.log('✅ Factura actualizada en cache local');
    console.log('🔍 Verificando emisor en cache después de actualizar:', localDataCache.invoices[invoiceIndex].issuerId);
    
    // Sincronizar automáticamente con Azure
    console.log('🔄 Iniciando sincronización con Azure...');
    try {
      await autoSyncAfterChange();
      console.log('✅ Sincronización con Azure completada');
    } catch (syncError) {
      console.error('❌ Error en sincronización con Azure:', syncError);
      console.log('⚠️ Los cambios se guardaron localmente pero podrían no haberse sincronizado');
      
      // Intentar guardado directo como método alternativo
      try {
        console.log('🔄 Intentando guardado directo alternativo...');
        const { saveDataToAzure } = await import('./azureBlobSync');
        const altSuccess = await saveDataToAzure({
          courses: localDataCache.courses,
          clients: localDataCache.clients,
          invoices: localDataCache.invoices,
          instructors: localDataCache.instructors,
          blackouts: localDataCache.blackouts,
          issuerProfiles: localDataCache.issuerProfiles,
          transferOptions: localDataCache.transferOptions,
          exportDate: new Date().toISOString(),
          version: 3
        });
        
        if (altSuccess) {
          console.log('✅ Sincronización alternativa exitosa');
        } else {
          console.log('❌ Sincronización alternativa también falló');
        }
      } catch (altError) {
        console.error('❌ Error en sincronización alternativa:', altError);
      }
    }
    
    console.log('🎯 Retornando factura actualizada con emisor:', updatedInvoice.issuerId);
    
    return updatedInvoice;
  } catch (error) {
    console.error('❌ Error actualizando factura:', error);
    return null;
  }
};

export const deleteInvoice = async (invoiceId: string): Promise<boolean> => {
  try {
    // Verificar si la factura existe y está pagada
    const invoiceToDelete = localDataCache.invoices.find(invoice => invoice.id === invoiceId);
    
    if (!invoiceToDelete) {
      console.warn('⚠️ Factura no encontrada para eliminar:', invoiceId);
      return false;
    }
    
    // Validación crítica: no permitir eliminar facturas pagadas sin confirmación especial
    if (invoiceToDelete.status === 'paid') {
      console.error('🚨 INTENTO DE ELIMINAR FACTURA PAGADA:', {
        invoiceNumber: invoiceToDelete.invoiceNumber,
        clientId: invoiceToDelete.clientId,
        total: invoiceToDelete.total,
        date: invoiceToDelete.invoiceDate
      });
      
      // Registro de seguridad
      console.warn('🔒 Eliminación de factura pagada requiere confirmación especial de usuario');
    }
    
    const initialLength = localDataCache.invoices.length;
    localDataCache.invoices = localDataCache.invoices.filter(invoice => invoice.id !== invoiceId);
    
    if (localDataCache.invoices.length === initialLength) {
      return false; // Invoice not found
    }
    
    console.log(`🗑️ Factura eliminada: ${invoiceToDelete.invoiceNumber} (${invoiceToDelete.status})`);
    
    // Sincronizar automáticamente con Azure
    await autoSyncAfterChange();
    
    return true;
  } catch (error) {
    console.error('❌ Error deleting invoice:', error);
    return false;
  }
};

export const getInvoiceById = async (invoiceId: string): Promise<InvoiceFromCourse | null> => {
  return localDataCache.invoices.find(invoice => invoice.id === invoiceId) || null;
};

// ========================= UTILITY FUNCTIONS =========================

export const generateCourseId = (): string => {
  return `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const generateClientId = (): string => {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const generateInvoiceId = (): string => {
  return `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ========================= INSTRUCTORS =========================

export const generateInstructorId = (): string => {
  return `instructor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const loadInstructors = async (): Promise<Instructor[]> => {
  return localDataCache.instructors;
};

export const addInstructor = async (data: Omit<Instructor, 'id'>): Promise<Instructor | null> => {
  try {
    if (!localDataCache.isInitialized) {
      await initializeFromAzure();
    }
    if (localDataCache.instructors.some(i => i.name.trim().toLowerCase() === data.name.trim().toLowerCase())) {
      console.warn('⚠️ Instructor duplicado por nombre:', data.name);
      return null;
    }
    const instructor: Instructor = { id: generateInstructorId(), ...data };
    localDataCache.instructors.push(instructor);
    const ok = await forceSaveToAzure();
    if (!ok) console.warn('⚠️ No se pudo sincronizar instructor, queda en cache local');
    window.dispatchEvent(new CustomEvent('instructorUpdated'));
    return instructor;
  } catch (e) {
    console.error('❌ Error agregando instructor:', e);
    return null;
  }
};

export const updateInstructor = async (instructorId: string, data: Omit<Instructor, 'id'>): Promise<Instructor | null> => {
  try {
    const idx = localDataCache.instructors.findIndex(i => i.id === instructorId);
    if (idx === -1) return null;
    if (localDataCache.instructors.some(i => i.id !== instructorId && i.name.trim().toLowerCase() === data.name.trim().toLowerCase())) {
      console.warn('⚠️ Nombre de instructor ya existe:', data.name);
      return null;
    }
    const updated: Instructor = { ...localDataCache.instructors[idx], ...data, id: instructorId };
    localDataCache.instructors[idx] = updated;
    const ok = await forceSaveToAzure();
    if (!ok) console.warn('⚠️ No se pudo sincronizar actualización de instructor');
    window.dispatchEvent(new CustomEvent('instructorUpdated'));
    return updated;
  } catch (e) {
    console.error('❌ Error actualizando instructor:', e);
    return null;
  }
};

export const deleteInstructor = async (instructorId: string): Promise<{ removed: boolean; reason?: string }> => {
  try {
    if (localDataCache.courses.some(c => c.instructorId === instructorId)) {
      const idx = localDataCache.instructors.findIndex(i => i.id === instructorId);
      if (idx !== -1) {
        localDataCache.instructors[idx] = { ...localDataCache.instructors[idx], active: false };
        await forceSaveToAzure();
        window.dispatchEvent(new CustomEvent('instructorUpdated'));
      }
      return { removed: false, reason: 'in-use-marked-inactive' };
    }
    const before = localDataCache.instructors.length;
    localDataCache.instructors = localDataCache.instructors.filter(i => i.id !== instructorId);
    if (localDataCache.instructors.length === before) return { removed: false, reason: 'not-found' };
    await forceSaveToAzure();
    window.dispatchEvent(new CustomEvent('instructorUpdated'));
    return { removed: true };
  } catch (e) {
    console.error('❌ Error eliminando instructor:', e);
    return { removed: false, reason: 'error' };
  }
};

// ========================= ISSUERS =========================

export const generateIssuerId = (): string => {
  return `issuer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const loadIssuerProfiles = async (): Promise<IssuerProfile[]> => {
  if (!localDataCache.isInitialized) {
    await initializeFromAzure();
  }
  return localDataCache.issuerProfiles;
};

export const addIssuerProfile = async (data: Omit<IssuerProfile, 'id'> & { id?: string }): Promise<IssuerProfile | null> => {
  try {
    if (!localDataCache.isInitialized) {
      await initializeFromAzure();
    }

    const id = (data.id || '').trim() || generateIssuerId();
    const label = data.label.trim();
    if (!label) return null;
    if (localDataCache.issuerProfiles.some(p => p.id === id)) {
      console.warn('⚠️ Issuer duplicado por id:', id);
      return null;
    }

    const profile: IssuerProfile = {
      id,
      label,
      name: data.name,
      nit: data.nit,
      address: data.address,
      phone: data.phone,
      city: data.city,
      email: data.email
    };
    markProtectedSectionDirty('issuerProfiles');
    localDataCache.issuerProfiles.push(profile);
    const ok = await forceSaveToAzure();
    if (!ok) console.warn('⚠️ No se pudo sincronizar emisor, queda en cache local');
    window.dispatchEvent(new CustomEvent('issuerUpdated'));
    return profile;
  } catch (e) {
    console.error('❌ Error agregando emisor:', e);
    return null;
  }
};

export const updateIssuerProfile = async (issuerId: string, data: Omit<IssuerProfile, 'id'>): Promise<IssuerProfile | null> => {
  try {
    const idx = localDataCache.issuerProfiles.findIndex(p => p.id === issuerId);
    if (idx === -1) return null;
    const updated: IssuerProfile = { ...localDataCache.issuerProfiles[idx], ...data, id: issuerId };
    markProtectedSectionDirty('issuerProfiles');
    localDataCache.issuerProfiles[idx] = updated;
    const ok = await forceSaveToAzure();
    if (!ok) console.warn('⚠️ No se pudo sincronizar actualización de emisor');
    window.dispatchEvent(new CustomEvent('issuerUpdated'));
    return updated;
  } catch (e) {
    console.error('❌ Error actualizando emisor:', e);
    return null;
  }
};

export const deleteIssuerProfile = async (issuerId: string): Promise<{ removed: boolean; reason?: string }> => {
  try {
    if (localDataCache.invoices.some(inv => inv.issuerId === issuerId)) {
      return { removed: false, reason: 'in-use' };
    }
    const before = localDataCache.issuerProfiles.length;
    markProtectedSectionDirty('issuerProfiles');
    localDataCache.issuerProfiles = localDataCache.issuerProfiles.filter(p => p.id !== issuerId);
    if (localDataCache.issuerProfiles.length === before) return { removed: false, reason: 'not-found' };
    await forceSaveToAzure();
    window.dispatchEvent(new CustomEvent('issuerUpdated'));
    return { removed: true };
  } catch (e) {
    console.error('❌ Error eliminando emisor:', e);
    return { removed: false, reason: 'error' };
  }
};

// ========================= TRANSFER OPTIONS =========================

export const generateTransferOptionId = (): string => {
  return `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const loadTransferOptions = async (): Promise<TransferOptionProfile[]> => {
  if (!localDataCache.isInitialized) {
    await initializeFromAzure();
  }
  return localDataCache.transferOptions;
};

export const addTransferOption = async (data: Omit<TransferOptionProfile, 'id'> & { id?: string }): Promise<TransferOptionProfile | null> => {
  try {
    if (!localDataCache.isInitialized) {
      await initializeFromAzure();
    }

    const id = (data.id || '').trim() || generateTransferOptionId();
    const label = data.label.trim();
    if (!label) return null;
    if (localDataCache.transferOptions.some(p => p.id === id)) {
      console.warn('⚠️ Transfer duplicado por id:', id);
      return null;
    }

    const profile: TransferOptionProfile = {
      id,
      label,
      bankName: data.bankName,
      bankAddress: data.bankAddress,
      country: data.country,
      swiftCode: data.swiftCode,
      accountOwner: data.accountOwner,
      accountNumber: data.accountNumber,
      accountOwnerAddress: data.accountOwnerAddress,
      routingNumber: data.routingNumber,
      abaCode: data.abaCode
    };
    markProtectedSectionDirty('transferOptions');
    localDataCache.transferOptions.push(profile);
    const ok = await forceSaveToAzure();
    if (!ok) console.warn('⚠️ No se pudo sincronizar transferencia, queda en cache local');
    window.dispatchEvent(new CustomEvent('transferOptionUpdated'));
    return profile;
  } catch (e) {
    console.error('❌ Error agregando opción de transferencia:', e);
    return null;
  }
};

export const updateTransferOption = async (transferOptionId: string, data: Omit<TransferOptionProfile, 'id'>): Promise<TransferOptionProfile | null> => {
  try {
    const idx = localDataCache.transferOptions.findIndex(p => p.id === transferOptionId);
    if (idx === -1) return null;
    const updated: TransferOptionProfile = { ...localDataCache.transferOptions[idx], ...data, id: transferOptionId };
    markProtectedSectionDirty('transferOptions');
    localDataCache.transferOptions[idx] = updated;
    const ok = await forceSaveToAzure();
    if (!ok) console.warn('⚠️ No se pudo sincronizar actualización de transferencia');
    window.dispatchEvent(new CustomEvent('transferOptionUpdated'));
    return updated;
  } catch (e) {
    console.error('❌ Error actualizando opción de transferencia:', e);
    return null;
  }
};

export const deleteTransferOption = async (transferOptionId: string): Promise<{ removed: boolean; reason?: string }> => {
  try {
    if (localDataCache.invoices.some(inv => inv.transferOptionId === transferOptionId)) {
      return { removed: false, reason: 'in-use' };
    }
    const before = localDataCache.transferOptions.length;
    markProtectedSectionDirty('transferOptions');
    localDataCache.transferOptions = localDataCache.transferOptions.filter(p => p.id !== transferOptionId);
    if (localDataCache.transferOptions.length === before) return { removed: false, reason: 'not-found' };
    await forceSaveToAzure();
    window.dispatchEvent(new CustomEvent('transferOptionUpdated'));
    return { removed: true };
  } catch (e) {
    console.error('❌ Error eliminando opción de transferencia:', e);
    return { removed: false, reason: 'error' };
  }
};

// ========================= INVOICE FOOTER NOTES =========================

export const loadInvoiceFooterNotes = async (): Promise<InvoiceFooterNote[]> => {
  if (!localDataCache.isInitialized) {
    await initializeFromAzure();
  }
  return localDataCache.invoiceFooterNotes;
};

export const addInvoiceFooterNote = async (data: Omit<InvoiceFooterNote, 'id'>): Promise<InvoiceFooterNote | null> => {
  try {
    if (!localDataCache.isInitialized) {
      await initializeFromAzure();
    }
    const note: InvoiceFooterNote = {
      id: `footer_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      effectiveFrom: normalizeDateYYYYMMDD(data.effectiveFrom, '2024-03-26'),
      es: (data.es || '').trim(),
      en: (data.en || '').trim()
    };
    markProtectedSectionDirty('invoiceFooterNotes');
    localDataCache.invoiceFooterNotes = normalizeInvoiceFooterNotes([...localDataCache.invoiceFooterNotes, note]);
    const ok = await forceSaveToAzure();
    if (!ok) console.warn('⚠️ No se pudo sincronizar nota de pie de factura');
    window.dispatchEvent(new CustomEvent('invoiceFooterNotesUpdated'));
    return note;
  } catch (e) {
    console.error('❌ Error agregando nota de pie de factura:', e);
    return null;
  }
};

export const updateInvoiceFooterNote = async (id: string, data: Omit<InvoiceFooterNote, 'id'>): Promise<InvoiceFooterNote | null> => {
  try {
    if (!localDataCache.isInitialized) {
      await initializeFromAzure();
    }
    const idx = localDataCache.invoiceFooterNotes.findIndex(n => n.id === id);
    if (idx === -1) return null;
    const updated: InvoiceFooterNote = {
      id,
      effectiveFrom: normalizeDateYYYYMMDD(data.effectiveFrom, localDataCache.invoiceFooterNotes[idx].effectiveFrom),
      es: (data.es || '').trim(),
      en: (data.en || '').trim()
    };
    markProtectedSectionDirty('invoiceFooterNotes');
    localDataCache.invoiceFooterNotes[idx] = updated;
    localDataCache.invoiceFooterNotes = normalizeInvoiceFooterNotes(localDataCache.invoiceFooterNotes);
    const ok = await forceSaveToAzure();
    if (!ok) console.warn('⚠️ No se pudo sincronizar actualización de nota de pie de factura');
    window.dispatchEvent(new CustomEvent('invoiceFooterNotesUpdated'));
    return updated;
  } catch (e) {
    console.error('❌ Error actualizando nota de pie de factura:', e);
    return null;
  }
};

export const deleteInvoiceFooterNote = async (id: string): Promise<boolean> => {
  try {
    if (!localDataCache.isInitialized) {
      await initializeFromAzure();
    }
    const before = localDataCache.invoiceFooterNotes.length;
    markProtectedSectionDirty('invoiceFooterNotes');
    localDataCache.invoiceFooterNotes = localDataCache.invoiceFooterNotes.filter(n => n.id !== id);
    if (localDataCache.invoiceFooterNotes.length === before) return false;
    localDataCache.invoiceFooterNotes = normalizeInvoiceFooterNotes(localDataCache.invoiceFooterNotes);
    const ok = await forceSaveToAzure();
    if (!ok) console.warn('⚠️ No se pudo sincronizar eliminación de nota de pie de factura');
    window.dispatchEvent(new CustomEvent('invoiceFooterNotesUpdated'));
    return true;
  } catch (e) {
    console.error('❌ Error eliminando nota de pie de factura:', e);
    return false;
  }
};

export const getApplicableInvoiceFooterText = async (invoiceDate: string, language: Language): Promise<string> => {
  if (!localDataCache.isInitialized) {
    await initializeFromAzure();
  }
  const date = normalizeDateYYYYMMDD(invoiceDate, new Date().toISOString().split('T')[0]);
  const notes = localDataCache.invoiceFooterNotes;
  if (!notes.length) return '';
  const sorted = [...notes].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

  // Tomar la última nota con effectiveFrom <= invoiceDate
  let selected = sorted.filter(n => n.effectiveFrom <= date).slice(-1)[0];
  if (!selected) selected = sorted[0];

  const text = language === 'es' ? selected.es : selected.en;
  return (text || '').trim();
};

// ========================= INVOICE NUMBERING =========================

export const loadInvoiceNumberingSettings = async (): Promise<InvoiceNumberingSettings> => {
  if (!localDataCache.isInitialized) {
    await initializeFromAzure();
  }
  return localDataCache.invoiceNumbering;
};

export const updateInvoiceNumberingSettings = async (settings: InvoiceNumberingSettings): Promise<InvoiceNumberingSettings | null> => {
  try {
    if (!localDataCache.isInitialized) {
      await initializeFromAzure();
    }
    markProtectedSectionDirty('invoiceNumbering');
    localDataCache.invoiceNumbering = normalizeInvoiceNumberingSettings(settings);
    const ok = await forceSaveToAzure();
    if (!ok) console.warn('⚠️ No se pudo sincronizar numeración de facturas');
    window.dispatchEvent(new CustomEvent('invoiceNumberingUpdated'));
    return localDataCache.invoiceNumbering;
  } catch (e) {
    console.error('❌ Error actualizando numeración de facturas:', e);
    return null;
  }
};

const computeNextInvoiceSequenceNumber = (prefix: string, fallbackNextNumber: number): number => {
  const effectivePrefix = prefix.trim() || defaultInvoiceNumberingSettings.prefix;
  const nextNumber = Number.isFinite(fallbackNextNumber) && fallbackNextNumber >= 1
    ? Math.floor(fallbackNextNumber)
    : defaultInvoiceNumberingSettings.startNumber;

  const pattern = new RegExp(`^${escapeRegExp(effectivePrefix)}[-\\s_]*(\\d+)$`);
  const invoiceNumbers = localDataCache.invoices
    .map(invoice => (invoice.invoiceNumber || '').trim())
    .map((num) => {
      const m = pattern.exec(num);
      return m ? parseInt(m[1], 10) : NaN;
    })
    .filter(num => !isNaN(num))
    .sort((a, b) => b - a);

  const maxExisting = invoiceNumbers.length > 0 ? invoiceNumbers[0] : null;
  const maxPlusOne = maxExisting !== null ? (maxExisting + 1) : null;
  return Math.max(nextNumber, maxPlusOne ?? 0);
};

// Reserva el siguiente número de factura (persistente). Úsalo SOLO cuando efectivamente vas a generar/guardar.
export const reserveNextInvoiceNumber = async (): Promise<string> => {
  if (!localDataCache.isInitialized) {
    await initializeFromAzure();
  }

  const settings = normalizeInvoiceNumberingSettings(localDataCache.invoiceNumbering);
  const prefix = (settings.prefix || defaultInvoiceNumberingSettings.prefix).trim() || defaultInvoiceNumberingSettings.prefix;
  const next = computeNextInvoiceSequenceNumber(prefix, settings.nextNumber ?? settings.startNumber);
  const reserved = `${prefix}${next}`;

  // Avanzar y persistir
  markProtectedSectionDirty('invoiceNumbering');
  localDataCache.invoiceNumbering = {
    ...settings,
    prefix,
    nextNumber: next + 1
  };

  const ok = await forceSaveToAzure();
  if (!ok) console.warn('⚠️ No se pudo sincronizar reserva de numeración de facturas');
  window.dispatchEvent(new CustomEvent('invoiceNumberingUpdated'));
  return reserved;
};

export const getNextInvoiceNumber = async (): Promise<string> => {
  if (!localDataCache.isInitialized) {
    await initializeFromAzure();
  }
  const settings = normalizeInvoiceNumberingSettings(localDataCache.invoiceNumbering);
  const prefix = (settings.prefix || defaultInvoiceNumberingSettings.prefix).trim() || defaultInvoiceNumberingSettings.prefix;
  const next = computeNextInvoiceSequenceNumber(prefix, settings.nextNumber ?? settings.startNumber);
  return `${prefix}${next}`;
};

export const getAvailableCoursesForInvoicing = async (clientId?: string): Promise<Course[]> => {
  const courses = localDataCache.courses;
  
  return courses.filter(course => {
    if (clientId && course.clientId !== clientId) {
      return false;
    }
    return course.status === 'creado' || course.status === 'dictado';
  });
};

// ========================= BLACKOUTS =========================

export const loadBlackouts = async (): Promise<Blackout[]> => {
  return localDataCache.blackouts;
};

export const addBlackout = async (data: Omit<Blackout, 'id'>): Promise<Blackout | null> => {
  try {
    if (!localDataCache.isInitialized) {
      await initializeFromAzure();
    }
    const newBlackout: Blackout = {
      ...data,
      id: `blackout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    localDataCache.blackouts.push(newBlackout);
    const saveSuccess = await forceSaveToAzure();
    if (!saveSuccess) {
      console.warn('⚠️ No se pudo sincronizar blackout, se mantiene en cache local');
    }
    window.dispatchEvent(new CustomEvent('blackoutUpdated'));
    return newBlackout;
  } catch (error) {
    console.error('❌ Error al agregar blackout:', error);
    return null;
  }
};

export const deleteBlackout = async (blackoutId: string): Promise<boolean> => {
  try {
    const initial = localDataCache.blackouts.length;
    localDataCache.blackouts = localDataCache.blackouts.filter(b => b.id !== blackoutId);
    if (localDataCache.blackouts.length === initial) return false;
    await autoSyncAfterChange();
    window.dispatchEvent(new CustomEvent('blackoutUpdated'));
    return true;
  } catch (error) {
    console.error('❌ Error eliminando blackout:', error);
    return false;
  }
};

export const updateBlackout = async (blackoutId: string, data: Omit<Blackout, 'id'>): Promise<Blackout | null> => {
  try {
    const i = localDataCache.blackouts.findIndex(b => b.id === blackoutId);
    if (i === -1) return null;
    const updated: Blackout = { ...localDataCache.blackouts[i], ...data, id: blackoutId };
    localDataCache.blackouts[i] = updated;
    await autoSyncAfterChange();
    window.dispatchEvent(new CustomEvent('blackoutUpdated'));
    return updated;
  } catch (error) {
    console.error('❌ Error actualizando blackout:', error);
    return null;
  }
};

// ========================= SYNC FUNCTIONS =========================

// Inicializar sincronización automática cada X minutos
export const initializeAutoSync = (intervalMinutes: number = 15): void => {
  console.log(`🔄 Iniciando sincronización automática cada ${intervalMinutes} minutos`);
  
  setInterval(async () => {
    try {
      console.log('🔄 Sincronización automática programada...');
      await autoSyncAfterChange();
    } catch (error) {
      console.error('❌ Error en sincronización automática programada:', error);
    }
  }, intervalMinutes * 60 * 1000);
};

// Función de exportación para compatibilidad (aunque ya no se use manualmente)
export const exportAllData = async (): Promise<string> => {
  const azureBlobConfig = getAzureBlobConfig() ?? undefined;
  const data = {
    courses: localDataCache.courses,
    clients: localDataCache.clients,
    invoices: localDataCache.invoices,
    azureBlobConfig,
    instructors: localDataCache.instructors,
    blackouts: localDataCache.blackouts,
    issuerProfiles: localDataCache.issuerProfiles,
    transferOptions: localDataCache.transferOptions,
    invoiceNumbering: localDataCache.invoiceNumbering,
    invoiceFooterNotes: localDataCache.invoiceFooterNotes,
    exportDate: new Date().toISOString(),
    version: 3
  };
  
  return JSON.stringify(data, null, 2);
};

/**
 * Crea (o sobrescribe) el JSON remoto con una estructura mínima/limpia.
 * Útil cuando el blob aún no existe y quieres iniciar desde cero en ese storage.
 */
export const createBlankRemoteJson = async (): Promise<boolean> => {
  try {
    // JSON realmente "vacío": sin configuración ni catálogos (emisores, transferencias, etc).
    const blank = {
      courses: [] as Course[],
      clients: [] as Client[],
      invoices: [] as InvoiceFromCourse[],
      exportDate: new Date().toISOString(),
      version: 3
    };

    return await saveDataToAzure(blank as any);
  } catch (error) {
    console.error('❌ Error creando JSON remoto en blanco:', error);
    return false;
  }
};

// Función de sincronización manual (para debug)
export const syncWithAzure = async (): Promise<{ success: boolean; message: string }> => {
  try {
    await autoSyncAfterChange();
    return { success: true, message: 'Sincronización exitosa' };
  } catch {
    return { success: false, message: 'Error en sincronización' };
  }
}; 

// Función para limpiar datos de ejemplo/inventados
export const clearExampleData = (): void => {
  console.log('🧹 Limpiando datos de ejemplo del cache local...');
  
  const exampleClientIds = ['client_default_1', 'client_default_2', 'client_default_3'];
  
  // Filtrar clientes de ejemplo
  const originalClientsCount = localDataCache.clients.length;
  localDataCache.clients = localDataCache.clients.filter(client => 
    !exampleClientIds.includes(client.id)
  );
  
  // Filtrar cursos asociados a clientes de ejemplo
  const originalCoursesCount = localDataCache.courses.length;
  localDataCache.courses = localDataCache.courses.filter(course => 
    !exampleClientIds.includes(course.clientId)
  );
  
  // Filtrar facturas asociadas a clientes de ejemplo
  const originalInvoicesCount = localDataCache.invoices.length;
  localDataCache.invoices = localDataCache.invoices.filter(invoice => 
    !exampleClientIds.includes(invoice.clientId)
  );
  
  console.log('🧹 Limpieza completada:', {
    clientesEliminados: originalClientsCount - localDataCache.clients.length,
    cursosEliminados: originalCoursesCount - localDataCache.courses.length,
    facturasEliminadas: originalInvoicesCount - localDataCache.invoices.length,
    clientesRestantes: localDataCache.clients.length,
    cursosRestantes: localDataCache.courses.length,
    facturasRestantes: localDataCache.invoices.length
  });
  
  // Marcar como inicializado y actualizar timestamp
  localDataCache.isInitialized = true;
  localDataCache.lastUpdate = new Date().toISOString();
}; 

export const validateInvoiceUpdate = async (invoiceId: string, expectedData: Partial<InvoiceFromCourse>): Promise<boolean> => {
  try {
    console.log('🔍 Validando actualización de factura:', invoiceId);
    
    // Buscar la factura en el cache local
    const cachedInvoice = localDataCache.invoices.find(inv => inv.id === invoiceId);
    
    if (!cachedInvoice) {
      console.error('❌ Factura no encontrada en cache local');
      return false;
    }
    
    // Verificar cada campo esperado
    let allFieldsValid = true;
    
    for (const [key, expectedValue] of Object.entries(expectedData)) {
      const actualValue = ((cachedInvoice as unknown) as Record<string, unknown>)[key];
      
      if (actualValue !== expectedValue) {
        console.error(`❌ Campo ${key} no coincide:`, {
          esperado: expectedValue,
          actual: actualValue
        });
        allFieldsValid = false;
      } else {
        console.log(`✅ Campo ${key} validado correctamente:`, actualValue);
      }
    }
    
    return allFieldsValid;
  } catch (error) {
    console.error('❌ Error validando actualización de factura:', error);
    return false;
  }
};

// ⚠️ BORRADO TOTAL: Limpia todos los datos (cursos/clientes/facturas/instructores/blackouts)
// y persiste el cambio en Azure (sobrescribe el JSON remoto).
export const clearAllData = async (): Promise<boolean> => {
  try {
    console.log('🗑️ BORRADO TOTAL: limpiando todo el cache local y Azure...');

    localDataCache.courses = [];
    localDataCache.clients = [];
    localDataCache.invoices = [];
    localDataCache.instructors = [];
    localDataCache.blackouts = [];
    localDataCache.issuerProfiles = [];
    localDataCache.transferOptions = [];
    localDataCache.invoiceNumbering = { ...defaultInvoiceNumberingSettings };
    localDataCache.invoiceFooterNotes = [];

    // Este flujo es explícitamente destructivo: debe sobrescribir también secciones protegidas.
    markProtectedSectionDirty('issuerProfiles');
    markProtectedSectionDirty('transferOptions');
    markProtectedSectionDirty('invoiceNumbering');
    markProtectedSectionDirty('invoiceFooterNotes');
    localDataCache.lastUpdate = new Date().toISOString();
    // Importante: marcar como inicializado para evitar re-hidratar desde Azure antes de guardar
    localDataCache.isInitialized = true;

    dispatchSyncEvent('start');
    const success = await forceSaveToAzure();

    if (success) {
      dispatchSyncEvent('success');
      window.dispatchEvent(new CustomEvent('courseUpdated'));
      window.dispatchEvent(new CustomEvent('clientUpdated'));
      window.dispatchEvent(new CustomEvent('invoiceUpdated'));
      window.dispatchEvent(new CustomEvent('instructorUpdated'));
      window.dispatchEvent(new CustomEvent('blackoutUpdated'));
      window.dispatchEvent(new CustomEvent('issuerUpdated'));
      window.dispatchEvent(new CustomEvent('transferOptionUpdated'));
      window.dispatchEvent(new CustomEvent('invoiceNumberingUpdated'));
      window.dispatchEvent(new CustomEvent('invoiceFooterNotesUpdated'));
      console.log('✅ BORRADO TOTAL completado y guardado en Azure');
      return true;
    }

    dispatchSyncEvent('error');
    console.log('❌ BORRADO TOTAL falló al guardar en Azure');
    return false;
  } catch (error) {
    dispatchSyncEvent('error');
    console.error('❌ Error en BORRADO TOTAL:', error);
    return false;
  }
};

export const diagnoseInvoiceIssues = async (invoiceId: string): Promise<void> => {
  try {
    console.log('🔍 === DIAGNÓSTICO ESPECÍFICO DE FACTURA ===');
    console.log('📋 ID de factura:', invoiceId);
    
    // Verificar en cache local
    const cachedInvoice = localDataCache.invoices.find(inv => inv.id === invoiceId);
    
    if (cachedInvoice) {
      console.log('✅ Factura encontrada en cache local:');
      console.log('📋 Datos actuales:', cachedInvoice);
      console.log('🔍 Emisor actual:', cachedInvoice.issuerId);
    } else {
      console.error('❌ Factura NO encontrada en cache local');
    }
    
    // Verificar en Azure
    console.log('🔍 Verificando datos en Azure...');
    const azureData = await loadDataFromAzure();
    
    if (azureData && azureData.invoices) {
      const azureInvoice = (azureData.invoices as unknown as InvoiceFromCourse[]).find((inv) => inv.id === invoiceId);
      
      if (azureInvoice) {
        console.log('✅ Factura encontrada en Azure:');
        console.log('📋 Datos en Azure:', azureInvoice);
        console.log('🔍 Emisor en Azure:', (azureInvoice as any).issuerId ?? (azureInvoice as any).issuer);
        
        // Comparar datos
        if (cachedInvoice) {
          console.log('🔍 Comparación Cache vs Azure:');
          console.log('  - Emisor Cache:', cachedInvoice.issuerId);
          console.log('  - Emisor Azure:', (azureInvoice as any).issuerId ?? (azureInvoice as any).issuer);
          console.log('  - ¿Coinciden?', cachedInvoice.issuerId === ((azureInvoice as any).issuerId ?? (azureInvoice as any).issuer) ? '✅' : '❌');
        }
      } else {
        console.error('❌ Factura NO encontrada en Azure');
      }
    } else {
      console.error('❌ No se pudieron cargar datos de Azure');
    }
    
    console.log('🔍 === FIN DIAGNÓSTICO ESPECÍFICO ===');
  } catch (error) {
    console.error('❌ Error en diagnóstico de factura:', error);
  }
}; 

export const forceReloadFromAzure = async (): Promise<boolean> => {
  try {
    console.log('🔄 FORZANDO RECARGA COMPLETA DESDE AZURE...');
    
    // Limpiar cache local
      localDataCache = {
        courses: [],
        clients: [],
        invoices: [],
        instructors: [],
        blackouts: [],
        issuerProfiles: [],
        transferOptions: [],
        invoiceNumbering: { ...defaultInvoiceNumberingSettings },
        invoiceFooterNotes: [],
        lastUpdate: new Date().toISOString(),
        isInitialized: false
      };
    
    console.log('🧹 Cache local limpiado');
    
    // Cargar datos frescos desde Azure
    const success = await initializeFromAzure();
    
    if (success) {
      console.log('✅ Recarga completa desde Azure exitosa');
      return true;
    } else {
      console.error('❌ Error en recarga completa desde Azure');
      return false;
    }
  } catch (error) {
    console.error('❌ Error en recarga forzada:', error);
    return false;
  }
}; 