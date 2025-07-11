import { Client, Course, InvoiceFromCourse } from '../types';
import { loadClients, loadCourses, loadInvoices, deleteClient, deleteCourse, deleteInvoice } from './storage';

// Función para limpiar automáticamente duplicados de clientes
export const cleanDuplicateClients = async (): Promise<number> => {
  console.log('🧹 Iniciando limpieza de clientes duplicados...');
  
  try {
    const clients = await loadClients();
    const seen = new Map<string, Client>();
    const duplicates: Client[] = [];
    
    // Identificar duplicados
    clients.forEach(client => {
      const key = `${client.name.toLowerCase().trim()}-${client.nit.replace(/\s+/g, '')}`;
      
      if (seen.has(key)) {
        // Este es un duplicado
        duplicates.push(client);
        console.log(`🗑️ Cliente duplicado encontrado: ${client.name} (${client.nit})`);
      } else {
        // Este es el primer cliente con esta combinación
        seen.set(key, client);
      }
    });
    
    // Eliminar duplicados
    for (const duplicate of duplicates) {
      await deleteClient(duplicate.id);
      console.log(`✅ Cliente duplicado eliminado: ${duplicate.name}`);
    }
    
    console.log(`🧹 Limpieza completada. ${duplicates.length} clientes duplicados eliminados.`);
    return duplicates.length;
  } catch (error) {
    console.error('❌ Error limpiando clientes duplicados:', error);
    return 0;
  }
};

// Función para limpiar automáticamente duplicados de cursos
export const cleanDuplicateCourses = async (): Promise<number> => {
  console.log('🧹 Iniciando limpieza de cursos duplicados...');
  
  try {
    const courses = await loadCourses();
    const seen = new Map<string, Course>();
    const duplicates: Course[] = [];
    
    // Identificar duplicados
    courses.forEach(course => {
      const key = `${course.courseName}-${course.clientId}-${course.startDate}-${course.endDate}`;
      
      if (seen.has(key)) {
        // Este es un duplicado
        duplicates.push(course);
        console.log(`🗑️ Curso duplicado encontrado: ${course.courseName} (${course.startDate} - ${course.endDate})`);
      } else {
        // Este es el primer curso con esta combinación
        seen.set(key, course);
      }
    });
    
    // Eliminar duplicados
    for (const duplicate of duplicates) {
      await deleteCourse(duplicate.id);
      console.log(`✅ Curso duplicado eliminado: ${duplicate.courseName}`);
    }
    
    console.log(`🧹 Limpieza completada. ${duplicates.length} cursos duplicados eliminados.`);
    return duplicates.length;
  } catch (error) {
    console.error('❌ Error limpiando cursos duplicados:', error);
    return 0;
  }
};

// Función para limpiar automáticamente duplicados de facturas
export const cleanDuplicateInvoices = async (): Promise<number> => {
  console.log('🧹 Iniciando limpieza de facturas duplicadas...');
  
  try {
    const invoices = await loadInvoices();
    const seen = new Map<string, InvoiceFromCourse>();
    const duplicates: InvoiceFromCourse[] = [];
    const protectedDuplicates: InvoiceFromCourse[] = [];
    
    // Identificar duplicados
    invoices.forEach(invoice => {
      const key = `${invoice.invoiceNumber}-${invoice.clientId}`;
      
      if (seen.has(key)) {
        // Esta es una factura duplicada
        if (invoice.status === 'paid') {
          // Proteger facturas pagadas duplicadas
          protectedDuplicates.push(invoice);
          console.log(`🔒 Factura pagada duplicada PROTEGIDA: ${invoice.invoiceNumber} (Cliente: ${invoice.clientId})`);
        } else {
          duplicates.push(invoice);
          console.log(`🗑️ Factura duplicada encontrada: ${invoice.invoiceNumber} (Cliente: ${invoice.clientId})`);
        }
      } else {
        // Esta es la primera factura con esta combinación
        seen.set(key, invoice);
      }
    });
    
    // Mostrar advertencia si hay facturas pagadas duplicadas
    if (protectedDuplicates.length > 0) {
      console.warn(`⚠️ Se encontraron ${protectedDuplicates.length} facturas pagadas duplicadas que NO fueron eliminadas por seguridad`);
      console.warn('🔒 Para eliminar facturas pagadas duplicadas, hazlo manualmente con confirmación especial');
    }
    
    // Eliminar solo duplicados no pagados
    for (const duplicate of duplicates) {
      await deleteInvoice(duplicate.id);
      console.log(`✅ Factura duplicada eliminada: ${duplicate.invoiceNumber}`);
    }
    
    console.log(`🧹 Limpieza completada. ${duplicates.length} facturas duplicadas eliminadas.`);
    if (protectedDuplicates.length > 0) {
      console.log(`🔒 ${protectedDuplicates.length} facturas pagadas duplicadas protegidas.`);
    }
    
    return duplicates.length;
  } catch (error) {
    console.error('❌ Error limpiando facturas duplicadas:', error);
    return 0;
  }
};

// Función para limpiar todos los duplicados del sistema
export const cleanAllDuplicates = async (): Promise<{ clients: number; courses: number; invoices: number }> => {
  console.log('🧹 Iniciando limpieza completa del sistema...');
  
  const clientsRemoved = await cleanDuplicateClients();
  const coursesRemoved = await cleanDuplicateCourses();
  const invoicesRemoved = await cleanDuplicateInvoices();
  
  const total = clientsRemoved + coursesRemoved + invoicesRemoved;
  
  console.log(`🎉 Limpieza completa terminada. Total eliminados: ${total}`);
  console.log(`   - Clientes: ${clientsRemoved}`);
  console.log(`   - Cursos: ${coursesRemoved}`);
  console.log(`   - Facturas: ${invoicesRemoved}`);
  
  return {
    clients: clientsRemoved,
    courses: coursesRemoved,
    invoices: invoicesRemoved
  };
};

// Función para verificar duplicados sin eliminar
export const detectDuplicates = async () => {
  console.log('🔍 Detectando duplicados en el sistema...');
  
  const [clients, courses, invoices] = await Promise.all([
    loadClients(),
    loadCourses(),
    loadInvoices()
  ]);
  
  // Detectar duplicados de clientes
  const clientDuplicates = new Set<string>();
  const clientsSeen = new Set<string>();
  clients.forEach(client => {
    const key = `${client.name.toLowerCase().trim()}-${client.nit.replace(/\s+/g, '')}`;
    if (clientsSeen.has(key)) {
      clientDuplicates.add(client.name);
    } else {
      clientsSeen.add(key);
    }
  });
  
  // Detectar duplicados de cursos
  const courseDuplicates = new Set<string>();
  const coursesSeen = new Set<string>();
  courses.forEach(course => {
    const key = `${course.courseName}-${course.clientId}-${course.startDate}-${course.endDate}`;
    if (coursesSeen.has(key)) {
      courseDuplicates.add(course.courseName);
    } else {
      coursesSeen.add(key);
    }
  });
  
  // Detectar duplicados de facturas
  const invoiceDuplicates = new Set<string>();
  const invoicesSeen = new Set<string>();
  invoices.forEach(invoice => {
    const key = `${invoice.invoiceNumber}-${invoice.clientId}`;
    if (invoicesSeen.has(key)) {
      invoiceDuplicates.add(invoice.invoiceNumber);
    } else {
      invoicesSeen.add(key);
    }
  });
  
  const duplicatesFound = {
    clients: Array.from(clientDuplicates),
    courses: Array.from(courseDuplicates),
    invoices: Array.from(invoiceDuplicates)
  };
  
  console.log('🔍 Duplicados detectados:', duplicatesFound);
  return duplicatesFound;
}; 