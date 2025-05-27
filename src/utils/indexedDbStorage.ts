import { Course } from '../types';

const DB_NAME = 'FacturacionDB';
const DB_VERSION = 1;
const COURSES_STORE = 'courses';

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
      
      // Crear la tabla de cursos si no existe
      if (!db.objectStoreNames.contains(COURSES_STORE)) {
        const store = db.createObjectStore(COURSES_STORE, { keyPath: 'id' });
        
        // Crear índices para búsquedas más rápidas
        store.createIndex('client', 'client', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('startDate', 'startDate', { unique: false });
      }
    };
  });
};

// Cargar todos los cursos
export const loadCoursesFromIndexedDB = async (): Promise<Course[]> => {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COURSES_STORE], 'readonly');
      const store = transaction.objectStore(COURSES_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        // Ordenar por fecha de creación (más recientes primero)
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

// Agregar un nuevo curso
export const addCourseToIndexedDB = async (courseData: Omit<Course, 'id'>): Promise<Course | null> => {
  try {
    const db = await initDB();
    const newCourse: Course = {
      ...courseData,
      id: `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    // Agregar timestamp de creación
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

// Actualizar un curso existente
export const updateCourseInIndexedDB = async (courseId: string, courseData: Omit<Course, 'id'>): Promise<Course | null> => {
  try {
    const db = await initDB();
    const updatedCourse: Course = {
      ...courseData,
      id: courseId,
    };

    // Agregar timestamp de actualización
    (updatedCourse as any).updatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COURSES_STORE], 'readwrite');
      const store = transaction.objectStore(COURSES_STORE);
      
      // Primero obtener el curso existente para preservar createdAt
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

// Eliminar un curso
export const deleteCourseFromIndexedDB = async (courseId: string): Promise<boolean> => {
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

// Obtener un curso por ID
export const getCourseByIdFromIndexedDB = async (courseId: string): Promise<Course | null> => {
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

// Exportar todos los cursos a JSON (para backup)
export const exportCoursesToJSON = async (): Promise<string> => {
  try {
    const courses = await loadCoursesFromIndexedDB();
    return JSON.stringify(courses, null, 2);
  } catch (error) {
    console.error('Error exporting courses:', error);
    return '[]';
  }
};

// Importar cursos desde JSON
export const importCoursesFromJSON = async (jsonData: string): Promise<boolean> => {
  try {
    const courses: Course[] = JSON.parse(jsonData);
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COURSES_STORE], 'readwrite');
      const store = transaction.objectStore(COURSES_STORE);
      
      let completed = 0;
      const total = courses.length;
      
      if (total === 0) {
        resolve(true);
        return;
      }

      courses.forEach(course => {
        const request = store.put(course);
        
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve(true);
          }
        };
        
        request.onerror = () => {
          console.error('Error importing course:', course.id, request.error);
          completed++;
          if (completed === total) {
            resolve(false);
          }
        };
      });
    });
  } catch (error) {
    console.error('Error importing courses from JSON:', error);
    return false;
  }
};

// Limpiar todos los datos (útil para testing)
export const clearAllCourses = async (): Promise<boolean> => {
  try {
    const db = await initDB();

    return new Promise((resolve) => {
      const transaction = db.transaction([COURSES_STORE], 'readwrite');
      const store = transaction.objectStore(COURSES_STORE);
      const request = store.clear();

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        console.error('Error clearing courses:', request.error);
        resolve(false);
      };
    });
  } catch (error) {
    console.error('Error clearing courses:', error);
    return false;
  }
}; 