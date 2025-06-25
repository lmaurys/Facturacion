import { Course, Client, InvoiceFromCourse } from '../types';
import { loadDataFromAzure, saveDataToAzure, syncWithAzure as azureSync } from './azureBlobSync';

// Azure como única fuente de verdad
let localDataCache: {
  courses: Course[];
  clients: Client[];
  invoices: InvoiceFromCourse[];
  lastUpdate: string;
} = {
  courses: [],
  clients: [],
  invoices: [],
  lastUpdate: new Date().toISOString()
};

// Eventos para notificar a la UI
const dispatchSyncEvent = (type: 'start' | 'success' | 'error') => {
  window.dispatchEvent(new CustomEvent(`azureSync${type.charAt(0).toUpperCase() + type.slice(1)}`));
};

// Función para sincronizar automáticamente después de cada cambio
const autoSyncAfterChange = async () => {
  try {
    dispatchSyncEvent('start');
    
    const dataToSync = {
      courses: localDataCache.courses,
      clients: localDataCache.clients,
      invoices: localDataCache.invoices,
      exportDate: new Date().toISOString(),
      version: 2
    };

    const success = await saveDataToAzure(dataToSync);
    
    if (success) {
      localDataCache.lastUpdate = new Date().toISOString();
      dispatchSyncEvent('success');
      console.log('✅ Sincronización automática exitosa');
    } else {
      dispatchSyncEvent('error');
      console.log('❌ Error en sincronización automática');
    }
  } catch (error) {
    dispatchSyncEvent('error');
    console.error('❌ Error en sincronización automática:', error);
  }
};

// Cargar datos iniciales desde Azure
export const initializeFromAzure = async (): Promise<boolean> => {
  try {
    console.log('🔄 Cargando datos iniciales desde Azure...');
    dispatchSyncEvent('start');
    
    const azureData = await loadDataFromAzure();
    
    if (azureData) {
      localDataCache = {
        courses: azureData.courses || [],
        clients: azureData.clients || [],
        invoices: azureData.invoices || [],
        lastUpdate: azureData.exportDate || new Date().toISOString()
      };
      
      dispatchSyncEvent('success');
      console.log('✅ Datos cargados desde Azure:', {
        courses: localDataCache.courses.length,
        clients: localDataCache.clients.length,
        invoices: localDataCache.invoices.length
      });
      return true;
    } else {
      // Si no hay datos en Azure, crear estructura vacía
      localDataCache = {
        courses: [],
        clients: [],
        invoices: [],
        lastUpdate: new Date().toISOString()
      };
      
      // Sincronizar estructura vacía con Azure
      await autoSyncAfterChange();
      return true;
    }
  } catch (error) {
    dispatchSyncEvent('error');
    console.error('❌ Error cargando datos iniciales desde Azure:', error);
    return false;
  }
};

// ========================= COURSES =========================

export const loadCourses = async (): Promise<Course[]> => {
  return localDataCache.courses;
};

export const addCourse = async (courseData: Omit<Course, 'id'>): Promise<Course | null> => {
  try {
    const newCourse: Course = {
      ...courseData,
      id: generateCourseId()
    };
    
    localDataCache.courses.push(newCourse);
    
    // Sincronizar automáticamente con Azure
    await autoSyncAfterChange();
    
    return newCourse;
  } catch (error) {
    console.error('Error adding course:', error);
    return null;
  }
};

export const updateCourse = async (courseId: string, courseData: Omit<Course, 'id'>): Promise<Course | null> => {
  try {
    const courseIndex = localDataCache.courses.findIndex(course => course.id === courseId);
    
    if (courseIndex === -1) {
      return null;
    }
    
    const updatedCourse: Course = {
      ...localDataCache.courses[courseIndex],
      ...courseData,
      id: courseId
    };
    
    localDataCache.courses[courseIndex] = updatedCourse;
    
    // Sincronizar automáticamente con Azure
    await autoSyncAfterChange();
    
    return updatedCourse;
  } catch (error) {
    console.error('Error updating course:', error);
    return null;
  }
};

export const deleteCourse = async (courseId: string): Promise<boolean> => {
  try {
    const initialLength = localDataCache.courses.length;
    localDataCache.courses = localDataCache.courses.filter(course => course.id !== courseId);
    
    if (localDataCache.courses.length === initialLength) {
      return false; // Course not found
    }
    
    // Sincronizar automáticamente con Azure
    await autoSyncAfterChange();
    
    return true;
  } catch (error) {
    console.error('Error deleting course:', error);
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
    const newClient: Client = {
      ...clientData,
      id: generateClientId()
    };
    
    localDataCache.clients.push(newClient);
    
    // Sincronizar automáticamente con Azure
    await autoSyncAfterChange();
    
    return newClient;
  } catch (error) {
    console.error('Error adding client:', error);
    return null;
  }
};

export const updateClient = async (clientId: string, clientData: Omit<Client, 'id'>): Promise<Client | null> => {
  try {
    const clientIndex = localDataCache.clients.findIndex(client => client.id === clientId);
    
    if (clientIndex === -1) {
      return null;
    }
    
    const updatedClient: Client = {
      ...localDataCache.clients[clientIndex],
      ...clientData,
      id: clientId
    };
    
    localDataCache.clients[clientIndex] = updatedClient;
    
    // Sincronizar automáticamente con Azure
    await autoSyncAfterChange();
    
    return updatedClient;
  } catch (error) {
    console.error('Error updating client:', error);
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
    const newInvoice: InvoiceFromCourse = {
      ...invoiceData,
      id: generateInvoiceId()
    };
    
    localDataCache.invoices.push(newInvoice);
    
    // Sincronizar automáticamente con Azure
    await autoSyncAfterChange();
    
    return newInvoice;
  } catch (error) {
    console.error('Error adding invoice:', error);
    return null;
  }
};

export const updateInvoice = async (invoiceId: string, invoiceData: Omit<InvoiceFromCourse, 'id'>): Promise<InvoiceFromCourse | null> => {
  try {
    const invoiceIndex = localDataCache.invoices.findIndex(invoice => invoice.id === invoiceId);
    
    if (invoiceIndex === -1) {
      return null;
    }
    
    const updatedInvoice: InvoiceFromCourse = {
      ...localDataCache.invoices[invoiceIndex],
      ...invoiceData,
      id: invoiceId
    };
    
    localDataCache.invoices[invoiceIndex] = updatedInvoice;
    
    // Sincronizar automáticamente con Azure
    await autoSyncAfterChange();
    
    return updatedInvoice;
  } catch (error) {
    console.error('Error updating invoice:', error);
    return null;
  }
};

export const deleteInvoice = async (invoiceId: string): Promise<boolean> => {
  try {
    const initialLength = localDataCache.invoices.length;
    localDataCache.invoices = localDataCache.invoices.filter(invoice => invoice.id !== invoiceId);
    
    if (localDataCache.invoices.length === initialLength) {
      return false; // Invoice not found
    }
    
    // Sincronizar automáticamente con Azure
    await autoSyncAfterChange();
    
    return true;
  } catch (error) {
    console.error('Error deleting invoice:', error);
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