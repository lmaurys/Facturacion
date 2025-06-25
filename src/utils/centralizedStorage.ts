import { Course, Client, InvoiceFromCourse } from '../types';
import { SyncData, syncWithAzure, saveDataToAzure, loadDataFromAzure, saveDataToAzureAlternative } from './azureBlobSync';

const DB_NAME = 'FacturacionDB';
const DB_VERSION = 2; // Incrementamos la versión para la nueva estructura
const COURSES_STORE = 'courses';
const CLIENTS_STORE = 'clients';
const INVOICES_STORE = 'invoices';

// Inicializar la base de datos IndexedDB
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Error opening IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Crear store de cursos
      if (!db.objectStoreNames.contains(COURSES_STORE)) {
        const coursesStore = db.createObjectStore(COURSES_STORE, { keyPath: 'id' });
        coursesStore.createIndex('clientId', 'clientId', { unique: false });
        coursesStore.createIndex('status', 'status', { unique: false });
        coursesStore.createIndex('startDate', 'startDate', { unique: false });
      }
      
      // Crear store de clientes
      if (!db.objectStoreNames.contains(CLIENTS_STORE)) {
        const clientsStore = db.createObjectStore(CLIENTS_STORE, { keyPath: 'id' });
        clientsStore.createIndex('name', 'name', { unique: false });
        clientsStore.createIndex('nit', 'nit', { unique: false });
      }
      
      // Crear store de facturas
      if (!db.objectStoreNames.contains(INVOICES_STORE)) {
        const invoicesStore = db.createObjectStore(INVOICES_STORE, { keyPath: 'id' });
        invoicesStore.createIndex('clientId', 'clientId', { unique: false });
        invoicesStore.createIndex('status', 'status', { unique: false });
        invoicesStore.createIndex('invoiceDate', 'invoiceDate', { unique: false });
      }
    };
  });
};

// ========================= COURSES =========================

export const loadCoursesFromDB = async (): Promise<Course[]> => {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COURSES_STORE], 'readonly');
      const store = transaction.objectStore(COURSES_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const courses = request.result.sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt || a.id).getTime();
          const dateB = new Date(b.createdAt || b.id).getTime();
          return dateB - dateA;
        });
        resolve(courses);
      };

      request.onerror = () => {
        console.error('Error loading courses from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error accessing IndexedDB:', error);
    return [];
  }
};

export const addCourseToDB = async (courseData: Omit<Course, 'id'>): Promise<Course | null> => {
  try {
    const db = await initDB();
    const newCourse: Course = {
      ...courseData,
      id: `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    (newCourse as any).createdAt = new Date().toISOString();
    (newCourse as any).updatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COURSES_STORE], 'readwrite');
      const store = transaction.objectStore(COURSES_STORE);
      const request = store.add(newCourse);

      request.onsuccess = () => {
        resolve(newCourse);
      };

      request.onerror = () => {
        console.error('Error adding course to IndexedDB:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error adding course to IndexedDB:', error);
    return null;
  }
};

export const updateCourseInDB = async (courseId: string, courseData: Omit<Course, 'id'>): Promise<Course | null> => {
  try {
    const db = await initDB();
    const updatedCourse: Course = {
      ...courseData,
      id: courseId,
    };

    (updatedCourse as any).updatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COURSES_STORE], 'readwrite');
      const store = transaction.objectStore(COURSES_STORE);
      
      const getRequest = store.get(courseId);
      
      getRequest.onsuccess = () => {
        const existingCourse = getRequest.result;
        if (existingCourse) {
          (updatedCourse as any).createdAt = existingCourse.createdAt;
        }
        
        const putRequest = store.put(updatedCourse);
        
        putRequest.onsuccess = () => {
          resolve(updatedCourse);
        };
        
        putRequest.onerror = () => {
          console.error('Error updating course in IndexedDB:', putRequest.error);
          reject(putRequest.error);
        };
      };
      
      getRequest.onerror = () => {
        console.error('Error finding course to update:', getRequest.error);
        reject(getRequest.error);
      };
    });
  } catch (error) {
    console.error('Error updating course in IndexedDB:', error);
    return null;
  }
};

export const deleteCourseFromDB = async (courseId: string): Promise<boolean> => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COURSES_STORE], 'readwrite');
      const store = transaction.objectStore(COURSES_STORE);
      const request = store.delete(courseId);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        console.error('Error deleting course from IndexedDB:', request.error);
        resolve(false);
      };
    });
  } catch (error) {
    console.error('Error deleting course from IndexedDB:', error);
    return false;
  }
};

export const getCourseByIdFromDB = async (courseId: string): Promise<Course | null> => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COURSES_STORE], 'readonly');
      const store = transaction.objectStore(COURSES_STORE);
      const request = store.get(courseId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('Error getting course from IndexedDB:', request.error);
        resolve(null);
      };
    });
  } catch (error) {
    console.error('Error getting course from IndexedDB:', error);
    return null;
  }
};

// ========================= CLIENTS =========================

export const loadClientsFromDB = async (): Promise<Client[]> => {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CLIENTS_STORE], 'readonly');
      const store = transaction.objectStore(CLIENTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const clients = request.result.sort((a: any, b: any) => a.name.localeCompare(b.name));
        resolve(clients);
      };

      request.onerror = () => {
        console.error('Error loading clients from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error accessing IndexedDB:', error);
    return [];
  }
};

export const addClientToDB = async (clientData: Omit<Client, 'id'>): Promise<Client | null> => {
  try {
    const db = await initDB();
    const newClient: Client = {
      ...clientData,
      id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    (newClient as any).createdAt = new Date().toISOString();
    (newClient as any).updatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CLIENTS_STORE], 'readwrite');
      const store = transaction.objectStore(CLIENTS_STORE);
      const request = store.add(newClient);

      request.onsuccess = () => {
        resolve(newClient);
      };

      request.onerror = () => {
        console.error('Error adding client to IndexedDB:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error adding client to IndexedDB:', error);
    return null;
  }
};

export const updateClientInDB = async (clientId: string, clientData: Omit<Client, 'id'>): Promise<Client | null> => {
  try {
    const db = await initDB();
    const updatedClient: Client = {
      ...clientData,
      id: clientId,
    };

    (updatedClient as any).updatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CLIENTS_STORE], 'readwrite');
      const store = transaction.objectStore(CLIENTS_STORE);
      
      const getRequest = store.get(clientId);
      
      getRequest.onsuccess = () => {
        const existingClient = getRequest.result;
        if (existingClient) {
          (updatedClient as any).createdAt = existingClient.createdAt;
        }
        
        const putRequest = store.put(updatedClient);
        
        putRequest.onsuccess = () => {
          resolve(updatedClient);
        };
        
        putRequest.onerror = () => {
          console.error('Error updating client in IndexedDB:', putRequest.error);
          reject(putRequest.error);
        };
      };
      
      getRequest.onerror = () => {
        console.error('Error finding client to update:', getRequest.error);
        reject(getRequest.error);
      };
    });
  } catch (error) {
    console.error('Error updating client in IndexedDB:', error);
    return null;
  }
};

export const deleteClientFromDB = async (clientId: string): Promise<boolean> => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CLIENTS_STORE], 'readwrite');
      const store = transaction.objectStore(CLIENTS_STORE);
      const request = store.delete(clientId);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        console.error('Error deleting client from IndexedDB:', request.error);
        resolve(false);
      };
    });
  } catch (error) {
    console.error('Error deleting client from IndexedDB:', error);
    return false;
  }
};

export const getClientByIdFromDB = async (clientId: string): Promise<Client | null> => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CLIENTS_STORE], 'readonly');
      const store = transaction.objectStore(CLIENTS_STORE);
      const request = store.get(clientId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('Error getting client from IndexedDB:', request.error);
        resolve(null);
      };
    });
  } catch (error) {
    console.error('Error getting client from IndexedDB:', error);
    return null;
  }
};

// ========================= EXPORT/IMPORT CENTRALIZADO =========================

export const exportAllDataToJSON = async (): Promise<string> => {
  try {
    const [courses, clients, invoices] = await Promise.all([
      loadCoursesFromDB(),
      loadClientsFromDB(),
      loadInvoicesFromDB()
    ]);

    const allData = {
      courses,
      clients,
      invoices,
      exportDate: new Date().toISOString(),
      version: DB_VERSION
    };

    return JSON.stringify(allData, null, 2);
  } catch (error) {
    console.error('Error exporting all data:', error);
    return JSON.stringify({ courses: [], clients: [], invoices: [], exportDate: new Date().toISOString(), version: DB_VERSION }, null, 2);
  }
};

export const importAllDataFromJSON = async (jsonData: string): Promise<boolean> => {
  try {
    const data = JSON.parse(jsonData);
    const { courses = [], clients = [], invoices = [] } = data;
    
    const db = await initDB();

    // Importar en transacciones separadas para mayor control
    const importClients = async () => {
      if (clients.length === 0) return true;
      
      return new Promise<boolean>((resolve) => {
        const transaction = db.transaction([CLIENTS_STORE], 'readwrite');
        const store = transaction.objectStore(CLIENTS_STORE);
        
        let completed = 0;
        clients.forEach((client: Client) => {
          const request = store.put(client);
          request.onsuccess = () => {
            completed++;
            if (completed === clients.length) resolve(true);
          };
          request.onerror = () => {
            completed++;
            if (completed === clients.length) resolve(false);
          };
        });
      });
    };

    const importCourses = async () => {
      if (courses.length === 0) return true;
      
      return new Promise<boolean>((resolve) => {
        const transaction = db.transaction([COURSES_STORE], 'readwrite');
        const store = transaction.objectStore(COURSES_STORE);
        
        let completed = 0;
        courses.forEach((course: Course) => {
          const request = store.put(course);
          request.onsuccess = () => {
            completed++;
            if (completed === courses.length) resolve(true);
          };
          request.onerror = () => {
            completed++;
            if (completed === courses.length) resolve(false);
          };
        });
      });
    };

    const importInvoices = async () => {
      if (invoices.length === 0) return true;
      
      return new Promise<boolean>((resolve) => {
        const transaction = db.transaction([INVOICES_STORE], 'readwrite');
        const store = transaction.objectStore(INVOICES_STORE);
        
        let completed = 0;
        invoices.forEach((invoice: InvoiceFromCourse) => {
          const request = store.put(invoice);
          request.onsuccess = () => {
            completed++;
            if (completed === invoices.length) resolve(true);
          };
          request.onerror = () => {
            completed++;
            if (completed === invoices.length) resolve(false);
          };
        });
      });
    };

    // Importar todo en orden
    const clientsSuccess = await importClients();
    const coursesSuccess = await importCourses();
    const invoicesSuccess = await importInvoices();

    return clientsSuccess && coursesSuccess && invoicesSuccess;
  } catch (error) {
    console.error('Error importing all data from JSON:', error);
    return false;
  }
};

// ========================= INVOICES =========================

export const loadInvoicesFromDB = async (): Promise<InvoiceFromCourse[]> => {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([INVOICES_STORE], 'readonly');
      const store = transaction.objectStore(INVOICES_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const invoices = request.result.sort((a: any, b: any) => {
          const dateA = new Date(a.invoiceDate).getTime();
          const dateB = new Date(b.invoiceDate).getTime();
          return dateB - dateA;
        });
        resolve(invoices);
      };

      request.onerror = () => {
        console.error('Error loading invoices from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error accessing IndexedDB:', error);
    return [];
  }
};

export const addInvoiceToDB = async (invoiceData: Omit<InvoiceFromCourse, 'id'>): Promise<InvoiceFromCourse | null> => {
  try {
    const db = await initDB();
    const newInvoice: InvoiceFromCourse = {
      ...invoiceData,
      id: `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    (newInvoice as any).createdAt = new Date().toISOString();
    (newInvoice as any).updatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([INVOICES_STORE], 'readwrite');
      const store = transaction.objectStore(INVOICES_STORE);
      const request = store.add(newInvoice);

      request.onsuccess = () => {
        resolve(newInvoice);
      };

      request.onerror = () => {
        console.error('Error adding invoice to IndexedDB:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error adding invoice to IndexedDB:', error);
    return null;
  }
};

export const updateInvoiceInDB = async (invoiceId: string, invoiceData: Omit<InvoiceFromCourse, 'id'>): Promise<InvoiceFromCourse | null> => {
  try {
    const db = await initDB();
    const updatedInvoice: InvoiceFromCourse = {
      ...invoiceData,
      id: invoiceId,
    };

    (updatedInvoice as any).updatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([INVOICES_STORE], 'readwrite');
      const store = transaction.objectStore(INVOICES_STORE);
      
      const getRequest = store.get(invoiceId);
      
      getRequest.onsuccess = () => {
        const existingInvoice = getRequest.result;
        if (existingInvoice) {
          (updatedInvoice as any).createdAt = existingInvoice.createdAt;
        }
        
        const putRequest = store.put(updatedInvoice);
        
        putRequest.onsuccess = () => {
          resolve(updatedInvoice);
        };
        
        putRequest.onerror = () => {
          console.error('Error updating invoice in IndexedDB:', putRequest.error);
          reject(putRequest.error);
        };
      };
      
      getRequest.onerror = () => {
        console.error('Error finding invoice to update:', getRequest.error);
        reject(getRequest.error);
      };
    });
  } catch (error) {
    console.error('Error updating invoice in IndexedDB:', error);
    return null;
  }
};

export const deleteInvoiceFromDB = async (invoiceId: string): Promise<boolean> => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([INVOICES_STORE], 'readwrite');
      const store = transaction.objectStore(INVOICES_STORE);
      const request = store.delete(invoiceId);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        console.error('Error deleting invoice from IndexedDB:', request.error);
        resolve(false);
      };
    });
  } catch (error) {
    console.error('Error deleting invoice from IndexedDB:', error);
    return false;
  }
};

export const getInvoiceByIdFromDB = async (invoiceId: string): Promise<InvoiceFromCourse | null> => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([INVOICES_STORE], 'readonly');
      const store = transaction.objectStore(INVOICES_STORE);
      const request = store.get(invoiceId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('Error getting invoice from IndexedDB:', request.error);
        resolve(null);
      };
    });
  } catch (error) {
    console.error('Error getting invoice from IndexedDB:', error);
    return null;
  }
};

// ========================= AZURE SYNC =========================

/**
 * Exportar datos y sincronizar con Azure Blob Storage
 */
export const exportAndSyncToAzure = async (): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('Iniciando exportación y sincronización con Azure...');
    
    // Obtener datos locales
    const [courses, clients, invoices] = await Promise.all([
      loadCoursesFromDB(),
      loadClientsFromDB(),
      loadInvoicesFromDB()
    ]);

    const syncData: SyncData = {
      courses,
      clients,
      invoices,
      exportDate: new Date().toISOString(),
      version: DB_VERSION
    };

    // Intentar sincronizar con Azure
    const syncSuccess = await syncWithAzure(syncData);
    
    if (syncSuccess) {
      return {
        success: true,
        message: 'Datos sincronizados exitosamente con Azure Blob Storage'
      };
    } else {
      // Intentar método alternativo
      const altSuccess = await saveDataToAzureAlternative(syncData);
      if (altSuccess) {
        return {
          success: true,
          message: 'Datos sincronizados exitosamente con Azure (método alternativo)'
        };
      } else {
        return {
          success: false,
          message: 'Error al sincronizar con Azure Blob Storage'
        };
      }
    }
  } catch (error) {
    console.error('Error en exportación y sincronización:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
    };
  }
};

/**
 * Cargar datos desde Azure Blob Storage e importarlos localmente
 */
export const loadAndImportFromAzure = async (): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('Cargando datos desde Azure Blob Storage...');
    
    const remoteData = await loadDataFromAzure();
    
    if (!remoteData) {
      return {
        success: false,
        message: 'No se encontraron datos en Azure Blob Storage'
      };
    }

    // Importar datos remotos
    const jsonData = JSON.stringify(remoteData);
    const importSuccess = await importAllDataFromJSON(jsonData);
    
    if (importSuccess) {
      return {
        success: true,
        message: 'Datos importados exitosamente desde Azure Blob Storage'
      };
    } else {
      return {
        success: false,
        message: 'Error al importar datos desde Azure Blob Storage'
      };
    }
  } catch (error) {
    console.error('Error en carga e importación:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
    };
  }
};

/**
 * Función de sincronización automática que se ejecuta en segundo plano
 */
export const autoSyncWithAzure = async (): Promise<void> => {
  try {
    console.log('Sincronización automática con Azure iniciada...');
    
    const result = await exportAndSyncToAzure();
    
    if (result.success) {
      console.log('✅ Sincronización automática exitosa:', result.message);
    } else {
      console.warn('⚠️ Sincronización automática falló:', result.message);
    }
  } catch (error) {
    console.error('❌ Error en sincronización automática:', error);
  }
}; 