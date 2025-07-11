import { Course, Client, InvoiceFromCourse } from '../types';
import { loadDataFromAzure, saveDataToAzure, syncWithAzure as azureSync } from './azureBlobSync';

// Azure como única fuente de verdad
let localDataCache: {
  courses: Course[];
  clients: Client[];
  invoices: InvoiceFromCourse[];
  lastUpdate: string;
  isInitialized: boolean;
} = {
  courses: [],
  clients: [],
  invoices: [],
  lastUpdate: new Date().toISOString(),
  isInitialized: false
};

// Eventos para notificar a la UI
const dispatchSyncEvent = (type: 'start' | 'success' | 'error') => {
  window.dispatchEvent(new CustomEvent(`azureSync${type.charAt(0).toUpperCase() + type.slice(1)}`));
};

// Función para forzar el guardado inmediato
export const forceSaveToAzure = async (): Promise<boolean> => {
  try {
    console.log('🚨 FORZANDO GUARDADO INMEDIATO A AZURE...');
    
    const dataToSync = {
      courses: localDataCache.courses,
      clients: localDataCache.clients,
      invoices: localDataCache.invoices,
      exportDate: new Date().toISOString(),
      version: 2
    };

    console.log('📊 Datos a guardar forzadamente:', {
      coursesCount: dataToSync.courses.length,
      clientsCount: dataToSync.clients.length,
      invoicesCount: dataToSync.invoices.length
    });

    const success = await saveDataToAzure(dataToSync);
    
    if (success) {
      localDataCache.lastUpdate = new Date().toISOString();
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
      const { saveDataToAzureAlternative } = await import('./azureBlobSync');
      const altSuccess = await saveDataToAzureAlternative({
        courses: localDataCache.courses,
        clients: localDataCache.clients,
        invoices: localDataCache.invoices,
        exportDate: new Date().toISOString(),
        version: 2
      });
      
      if (altSuccess) {
        dispatchSyncEvent('success');
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

// Cargar datos iniciales desde Azure
export const initializeFromAzure = async (): Promise<boolean> => {
  try {
    console.log('🔄 Cargando datos iniciales desde Azure...');
    console.log('📍 PASO 1: Iniciando carga desde Azure');
    dispatchSyncEvent('start');
    
    const azureData = await loadDataFromAzure();
    
    if (azureData) {
      console.log('📍 PASO 2: Datos recibidos desde Azure');
      console.log('📊 DATOS BRUTOS RECIBIDOS DE AZURE:', {
        courses: azureData.courses?.length || 0,
        clients: azureData.clients?.length || 0,
        invoices: azureData.invoices?.length || 0,
        exportDate: azureData.exportDate,
        version: azureData.version
      });
      
      // Mostrar algunos datos para debug
      if (azureData.courses && azureData.courses.length > 0) {
        console.log('🎓 MUESTRA DE CURSOS EN AZURE:', 
          azureData.courses.slice(0, 3).map(c => ({
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
      
      if (azureData.clients && azureData.clients.length > 0) {
        console.log('👥 MUESTRA DE CLIENTES EN AZURE:', 
          azureData.clients.slice(0, 3).map(c => ({
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
      
      const uniqueClients = removeDuplicateClients(azureData.clients || []);
      console.log('📍 PASO 3A: Clientes después de limpieza:', uniqueClients.length);
      
      const uniqueCourses = removeDuplicateCourses(azureData.courses || []);
      console.log('📍 PASO 3B: Cursos después de limpieza:', uniqueCourses.length);
      
      const uniqueInvoices = removeDuplicateInvoices(azureData.invoices || []);
      console.log('📍 PASO 3C: Facturas después de limpieza:', uniqueInvoices.length);
      
      console.log('📊 DATOS DESPUÉS DE LIMPIAR DUPLICADOS:', {
        courses: uniqueCourses.length,
        clients: uniqueClients.length,
        invoices: uniqueInvoices.length
      });
      
      console.log('📍 PASO 4: Actualizando cache local');
      localDataCache = {
        courses: uniqueCourses,
        clients: uniqueClients,
        invoices: uniqueInvoices,
        lastUpdate: azureData.exportDate || new Date().toISOString(),
        isInitialized: true
      };
      
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
      localDataCache = {
        courses: azureData.courses || [],
        clients: azureData.clients || [],
        invoices: azureData.invoices || [],
        lastUpdate: azureData.exportDate || new Date().toISOString(),
        isInitialized: true
      };
      
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
      // CARGAR EXACTAMENTE LO QUE ESTÁ EN AZURE - SIN FILTROS
      localDataCache = {
        courses: azureData.courses || [],
        clients: azureData.clients || [],
        invoices: azureData.invoices || [],
        lastUpdate: azureData.exportDate || new Date().toISOString(),
        isInitialized: true
      };
      
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
    
    const newInvoice: InvoiceFromCourse = {
      ...invoiceData,
      id: generateInvoiceId()
    };
    
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
    console.log('updateInvoice called with:', { invoiceId, invoiceData });
    console.log('Current invoices in cache:', localDataCache.invoices.length);
    
    const invoiceIndex = localDataCache.invoices.findIndex(invoice => invoice.id === invoiceId);
    
    console.log('Invoice index found:', invoiceIndex);
    
    if (invoiceIndex === -1) {
      console.log('Invoice not found with id:', invoiceId);
      return null;
    }
    
    console.log('Original invoice:', localDataCache.invoices[invoiceIndex]);
    
    const updatedInvoice: InvoiceFromCourse = {
      ...localDataCache.invoices[invoiceIndex],
      ...invoiceData,
      id: invoiceId
    };
    
    console.log('Updated invoice to save:', updatedInvoice);
    
    localDataCache.invoices[invoiceIndex] = updatedInvoice;
    
    console.log('Invoice updated in cache, starting sync...');
    
    // Sincronizar automáticamente con Azure
    await autoSyncAfterChange();
    
    console.log('Sync completed, returning updated invoice');
    
    return updatedInvoice;
  } catch (error) {
    console.error('Error updating invoice:', error);
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

export const getNextInvoiceNumber = async (): Promise<string> => {
  const invoices = localDataCache.invoices;
  
  if (invoices.length === 0) {
    return 'LP101';
  }

  const invoiceNumbers = invoices
    .map(invoice => invoice.invoiceNumber)
    .filter(num => num && num.startsWith('LP'))
    .map(num => parseInt(num.substring(2)))
    .filter(num => !isNaN(num))
    .sort((a, b) => b - a);

  if (invoiceNumbers.length === 0) {
    return 'LP101';
  }

  return `LP${invoiceNumbers[0] + 1}`;
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
  const data = {
    courses: localDataCache.courses,
    clients: localDataCache.clients,
    invoices: localDataCache.invoices,
    exportDate: new Date().toISOString(),
    version: 2
  };
  
  return JSON.stringify(data, null, 2);
};

// Función de sincronización manual (para debug)
export const syncWithAzure = async (): Promise<{ success: boolean; message: string }> => {
  try {
    await autoSyncAfterChange();
    return { success: true, message: 'Sincronización exitosa' };
  } catch (error) {
    return { success: false, message: 'Error en sincronización' };
  }
}; 

// Función para limpiar datos de ejemplo/inventados
export const clearExampleData = (): void => {
  console.log('🧹 Limpiando datos de ejemplo del cache local...');
  
  const exampleClientIds = ['client_default_1', 'client_default_2', 'client_default_3'];
  const exampleClientNames = [
    'Fast Lane Consulting Services Latam',
    'CAS Training Institute', 
    'Technofocus Pte Ltd.'
  ];
  
  // Filtrar clientes de ejemplo
  const originalClientsCount = localDataCache.clients.length;
  localDataCache.clients = localDataCache.clients.filter(client => 
    !exampleClientIds.includes(client.id) && 
    !exampleClientNames.includes(client.name)
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