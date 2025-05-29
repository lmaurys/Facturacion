import { Course, Client, InvoiceFromCourse } from '../types';
import {
  loadCoursesFromDB,
  addCourseToDB,
  updateCourseInDB,
  deleteCourseFromDB,
  getCourseByIdFromDB,
  loadClientsFromDB,
  addClientToDB,
  updateClientInDB,
  deleteClientFromDB,
  getClientByIdFromDB,
  loadInvoicesFromDB,
  addInvoiceToDB,
  updateInvoiceInDB,
  deleteInvoiceFromDB,
  getInvoiceByIdFromDB,
  exportAllDataToJSON,
  importAllDataFromJSON
} from './centralizedStorage';

const COURSES_STORAGE_KEY = 'courses';
const CLIENTS_STORAGE_KEY = 'clients';
const INVOICES_STORAGE_KEY = 'invoices';

// Funciones de localStorage (como respaldo)
const saveCoursesToLocal = (courses: Course[]): void => {
  try {
    localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(courses));
  } catch (error) {
    console.error('Error saving courses to localStorage:', error);
  }
};

const loadCoursesFromLocal = (): Course[] => {
  try {
    const coursesData = localStorage.getItem(COURSES_STORAGE_KEY);
    if (coursesData) {
      return JSON.parse(coursesData);
    }
  } catch (error) {
    console.error('Error loading courses from localStorage:', error);
  }
  return [];
};

const saveClientsToLocal = (clients: Client[]): void => {
  try {
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
  } catch (error) {
    console.error('Error saving clients to localStorage:', error);
  }
};

const loadClientsFromLocal = (): Client[] => {
  try {
    const clientsData = localStorage.getItem(CLIENTS_STORAGE_KEY);
    if (clientsData) {
      return JSON.parse(clientsData);
    }
  } catch (error) {
    console.error('Error loading clients from localStorage:', error);
  }
  return [];
};

const saveInvoicesToLocal = (invoices: InvoiceFromCourse[]): void => {
  try {
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
  } catch (error) {
    console.error('Error saving invoices to localStorage:', error);
  }
};

const loadInvoicesFromLocal = (): InvoiceFromCourse[] => {
  try {
    const invoicesData = localStorage.getItem(INVOICES_STORAGE_KEY);
    if (invoicesData) {
      return JSON.parse(invoicesData);
    }
  } catch (error) {
    console.error('Error loading invoices from localStorage:', error);
  }
  return [];
};

// ========================= COURSES =========================

export const loadCourses = async (): Promise<Course[]> => {
  try {
    console.log('Loading courses from IndexedDB');
    return await loadCoursesFromDB();
  } catch (error) {
    console.error('Error loading courses from IndexedDB, falling back to localStorage:', error);
    return loadCoursesFromLocal();
  }
};

export const addCourse = async (courseData: Omit<Course, 'id'>): Promise<Course | null> => {
  try {
    console.log('Adding course to IndexedDB');
    const newCourse = await addCourseToDB(courseData);
    if (newCourse) {
      // También guardamos en localStorage como respaldo
      const localCourses = loadCoursesFromLocal();
      localCourses.push(newCourse);
      saveCoursesToLocal(localCourses);
    }
    return newCourse;
  } catch (error) {
    console.error('Error adding course to IndexedDB, falling back to localStorage:', error);
    // Usar localStorage como respaldo
    const newCourse: Course = {
      ...courseData,
      id: generateCourseId()
    };
    const courses = loadCoursesFromLocal();
    courses.push(newCourse);
    saveCoursesToLocal(courses);
    return newCourse;
  }
};

export const updateCourse = async (courseId: string, courseData: Omit<Course, 'id'>): Promise<Course | null> => {
  try {
    console.log('Updating course in IndexedDB');
    const updatedCourse = await updateCourseInDB(courseId, courseData);
    if (updatedCourse) {
      // También actualizamos en localStorage
      const localCourses = loadCoursesFromLocal();
      const courseIndex = localCourses.findIndex(course => course.id === courseId);
      if (courseIndex !== -1) {
        localCourses[courseIndex] = updatedCourse;
        saveCoursesToLocal(localCourses);
      }
    }
    return updatedCourse;
  } catch (error) {
    console.error('Error updating course in IndexedDB, falling back to localStorage:', error);
    // Usar localStorage como respaldo
    const courses = loadCoursesFromLocal();
    const courseIndex = courses.findIndex(course => course.id === courseId);
    
    if (courseIndex === -1) {
      return null;
    }
    
    const updatedCourse: Course = {
      ...courseData,
      id: courseId
    };
    
    courses[courseIndex] = updatedCourse;
    saveCoursesToLocal(courses);
    return updatedCourse;
  }
};

export const deleteCourse = async (courseId: string): Promise<boolean> => {
  try {
    console.log('Deleting course from IndexedDB');
    const success = await deleteCourseFromDB(courseId);
    if (success) {
      // También eliminamos de localStorage
      const localCourses = loadCoursesFromLocal();
      const filteredCourses = localCourses.filter(course => course.id !== courseId);
      saveCoursesToLocal(filteredCourses);
    }
    return success;
  } catch (error) {
    console.error('Error deleting course from IndexedDB, falling back to localStorage:', error);
    // Usar localStorage como respaldo
    const courses = loadCoursesFromLocal();
    const filteredCourses = courses.filter(course => course.id !== courseId);
    
    if (filteredCourses.length === courses.length) {
      return false; // Course not found
    }
    
    saveCoursesToLocal(filteredCourses);
    return true;
  }
};

export const getCourseById = async (courseId: string): Promise<Course | null> => {
  try {
    console.log('Getting course from IndexedDB');
    return await getCourseByIdFromDB(courseId);
  } catch (error) {
    console.error('Error getting course from IndexedDB, falling back to localStorage:', error);
    const courses = loadCoursesFromLocal();
    return courses.find(course => course.id === courseId) || null;
  }
};

// ========================= CLIENTS =========================

export const loadClients = async (): Promise<Client[]> => {
  try {
    console.log('Loading clients from IndexedDB');
    return await loadClientsFromDB();
  } catch (error) {
    console.error('Error loading clients from IndexedDB, falling back to localStorage:', error);
    return loadClientsFromLocal();
  }
};

export const addClient = async (clientData: Omit<Client, 'id'>): Promise<Client | null> => {
  try {
    console.log('Adding client to IndexedDB');
    const newClient = await addClientToDB(clientData);
    if (newClient) {
      // También guardamos en localStorage como respaldo
      const localClients = loadClientsFromLocal();
      localClients.push(newClient);
      saveClientsToLocal(localClients);
    }
    return newClient;
  } catch (error) {
    console.error('Error adding client to IndexedDB, falling back to localStorage:', error);
    // Usar localStorage como respaldo
    const newClient: Client = {
      ...clientData,
      id: generateClientId()
    };
    const clients = loadClientsFromLocal();
    clients.push(newClient);
    saveClientsToLocal(clients);
    return newClient;
  }
};

export const updateClient = async (clientId: string, clientData: Omit<Client, 'id'>): Promise<Client | null> => {
  try {
    console.log('Updating client in IndexedDB');
    const updatedClient = await updateClientInDB(clientId, clientData);
    if (updatedClient) {
      // También actualizamos en localStorage
      const localClients = loadClientsFromLocal();
      const clientIndex = localClients.findIndex(client => client.id === clientId);
      if (clientIndex !== -1) {
        localClients[clientIndex] = updatedClient;
        saveClientsToLocal(localClients);
      }
    }
    return updatedClient;
  } catch (error) {
    console.error('Error updating client in IndexedDB, falling back to localStorage:', error);
    // Usar localStorage como respaldo
    const clients = loadClientsFromLocal();
    const clientIndex = clients.findIndex(client => client.id === clientId);
    
    if (clientIndex === -1) {
      return null;
    }
    
    const updatedClient: Client = {
      ...clientData,
      id: clientId
    };
    
    clients[clientIndex] = updatedClient;
    saveClientsToLocal(clients);
    return updatedClient;
  }
};

export const deleteClient = async (clientId: string): Promise<boolean> => {
  try {
    console.log('Deleting client from IndexedDB');
    const success = await deleteClientFromDB(clientId);
    if (success) {
      // También eliminamos de localStorage
      const localClients = loadClientsFromLocal();
      const filteredClients = localClients.filter(client => client.id !== clientId);
      saveClientsToLocal(filteredClients);
    }
    return success;
  } catch (error) {
    console.error('Error deleting client from IndexedDB, falling back to localStorage:', error);
    // Usar localStorage como respaldo
    const clients = loadClientsFromLocal();
    const filteredClients = clients.filter(client => client.id !== clientId);
    
    if (filteredClients.length === clients.length) {
      return false; // Client not found
    }
    
    saveClientsToLocal(filteredClients);
    return true;
  }
};

export const getClientById = async (clientId: string): Promise<Client | null> => {
  try {
    console.log('Getting client from IndexedDB');
    return await getClientByIdFromDB(clientId);
  } catch (error) {
    console.error('Error getting client from IndexedDB, falling back to localStorage:', error);
    const clients = loadClientsFromLocal();
    return clients.find(client => client.id === clientId) || null;
  }
};

// ========================= UTILS =========================

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
  try {
    const invoices = await loadInvoices();
    
    // Buscar el número más alto que empiece con "LP"
    let maxNumber = 114; // Empezamos desde 114 para que el próximo sea LP115
    
    invoices.forEach(invoice => {
      if (invoice.invoiceNumber && invoice.invoiceNumber.startsWith('LP')) {
        const numberPart = invoice.invoiceNumber.substring(2);
        const currentNumber = parseInt(numberPart);
        if (!isNaN(currentNumber) && currentNumber > maxNumber) {
          maxNumber = currentNumber;
        }
      }
    });
    
    return `LP${maxNumber + 1}`;
  } catch (error) {
    console.error('Error getting next invoice number:', error);
    return `LP115`; // Valor por defecto si hay error
  }
};

export const getAvailableCoursesForInvoicing = async (clientId?: string): Promise<Course[]> => {
  try {
    const courses = await loadCourses();
    
    // Filtrar cursos que no han sido facturados (solo estado 'dictado')
    const availableCourses = courses.filter(course => {
      const isNotInvoiced = course.status === 'dictado'; // Solo cursos dictados pero no facturados
      const matchesClient = !clientId || course.clientId === clientId;
      return isNotInvoiced && matchesClient;
    });
    
    return availableCourses;
  } catch (error) {
    console.error('Error getting available courses for invoicing:', error);
    return [];
  }
};

// ========================= INVOICES =========================

export const loadInvoices = async (): Promise<InvoiceFromCourse[]> => {
  try {
    console.log('Loading invoices from IndexedDB');
    return await loadInvoicesFromDB();
  } catch (error) {
    console.error('Error loading invoices from IndexedDB, falling back to localStorage:', error);
    return loadInvoicesFromLocal();
  }
};

export const addInvoice = async (invoiceData: Omit<InvoiceFromCourse, 'id'>): Promise<InvoiceFromCourse | null> => {
  try {
    console.log('Adding invoice to IndexedDB');
    const newInvoice = await addInvoiceToDB(invoiceData);
    if (newInvoice) {
      // También guardamos en localStorage como respaldo
      const localInvoices = loadInvoicesFromLocal();
      localInvoices.push(newInvoice);
      saveInvoicesToLocal(localInvoices);
    }
    return newInvoice;
  } catch (error) {
    console.error('Error adding invoice to IndexedDB, falling back to localStorage:', error);
    // Usar localStorage como respaldo
    const newInvoice: InvoiceFromCourse = {
      ...invoiceData,
      id: generateInvoiceId()
    };
    const invoices = loadInvoicesFromLocal();
    invoices.push(newInvoice);
    saveInvoicesToLocal(invoices);
    return newInvoice;
  }
};

export const updateInvoice = async (invoiceId: string, invoiceData: Omit<InvoiceFromCourse, 'id'>): Promise<InvoiceFromCourse | null> => {
  try {
    console.log('Updating invoice in IndexedDB');
    const updatedInvoice = await updateInvoiceInDB(invoiceId, invoiceData);
    if (updatedInvoice) {
      // También actualizamos en localStorage
      const localInvoices = loadInvoicesFromLocal();
      const invoiceIndex = localInvoices.findIndex(invoice => invoice.id === invoiceId);
      if (invoiceIndex !== -1) {
        localInvoices[invoiceIndex] = updatedInvoice;
        saveInvoicesToLocal(localInvoices);
      }
    }
    return updatedInvoice;
  } catch (error) {
    console.error('Error updating invoice in IndexedDB, falling back to localStorage:', error);
    // Usar localStorage como respaldo
    const invoices = loadInvoicesFromLocal();
    const invoiceIndex = invoices.findIndex(invoice => invoice.id === invoiceId);
    
    if (invoiceIndex === -1) {
      return null;
    }
    
    const updatedInvoice: InvoiceFromCourse = {
      ...invoiceData,
      id: invoiceId
    };
    
    invoices[invoiceIndex] = updatedInvoice;
    saveInvoicesToLocal(invoices);
    return updatedInvoice;
  }
};

export const deleteInvoice = async (invoiceId: string): Promise<boolean> => {
  try {
    console.log('Deleting invoice from IndexedDB');
    const success = await deleteInvoiceFromDB(invoiceId);
    if (success) {
      // También eliminamos de localStorage
      const localInvoices = loadInvoicesFromLocal();
      const filteredInvoices = localInvoices.filter(invoice => invoice.id !== invoiceId);
      saveInvoicesToLocal(filteredInvoices);
    }
    return success;
  } catch (error) {
    console.error('Error deleting invoice from IndexedDB, falling back to localStorage:', error);
    // Usar localStorage como respaldo
    const invoices = loadInvoicesFromLocal();
    const filteredInvoices = invoices.filter(invoice => invoice.id !== invoiceId);
    
    if (filteredInvoices.length === invoices.length) {
      return false; // Invoice not found
    }
    
    saveInvoicesToLocal(filteredInvoices);
    return true;
  }
};

export const getInvoiceById = async (invoiceId: string): Promise<InvoiceFromCourse | null> => {
  try {
    console.log('Getting invoice from IndexedDB');
    return await getInvoiceByIdFromDB(invoiceId);
  } catch (error) {
    console.error('Error getting invoice from IndexedDB, falling back to localStorage:', error);
    const invoices = loadInvoicesFromLocal();
    return invoices.find(invoice => invoice.id === invoiceId) || null;
  }
};

// ========================= EXPORT/IMPORT CENTRALIZADO =========================

export const exportAllData = async (): Promise<string> => {
  try {
    return await exportAllDataToJSON();
  } catch (error) {
    console.error('Error exporting all data:', error);
    // Fallback a localStorage
    const courses = loadCoursesFromLocal();
    const clients = loadClientsFromLocal();
    const allData = {
      courses,
      clients,
      invoices: [],
      exportDate: new Date().toISOString(),
      version: 2
    };
    return JSON.stringify(allData, null, 2);
  }
};

export const importAllData = async (jsonData: string): Promise<boolean> => {
  try {
    return await importAllDataFromJSON(jsonData);
  } catch (error) {
    console.error('Error importing all data:', error);
    return false;
  }
};

// Funciones de compatibilidad hacia atrás (para no romper código existente)
export const exportCourses = exportAllData;
export const importCourses = importAllData; 