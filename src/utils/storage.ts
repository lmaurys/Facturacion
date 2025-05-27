import { Course } from '../types';
import {
  loadCoursesFromIndexedDB,
  addCourseToIndexedDB,
  updateCourseInIndexedDB,
  deleteCourseFromIndexedDB,
  getCourseByIdFromIndexedDB,
  exportCoursesToJSON,
  importCoursesFromJSON
} from './indexedDbStorage';

const COURSES_STORAGE_KEY = 'courses';

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

// Funciones principales que usan IndexedDB como almacenamiento principal
export const loadCourses = async (): Promise<Course[]> => {
  try {
    console.log('Loading courses from IndexedDB');
    return await loadCoursesFromIndexedDB();
  } catch (error) {
    console.error('Error loading courses from IndexedDB, falling back to localStorage:', error);
    return loadCoursesFromLocal();
  }
};

export const addCourse = async (courseData: Omit<Course, 'id'>): Promise<Course | null> => {
  try {
    console.log('Adding course to IndexedDB');
    const newCourse = await addCourseToIndexedDB(courseData);
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
    const updatedCourse = await updateCourseInIndexedDB(courseId, courseData);
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
    const success = await deleteCourseFromIndexedDB(courseId);
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
    return await getCourseByIdFromIndexedDB(courseId);
  } catch (error) {
    console.error('Error getting course from IndexedDB, falling back to localStorage:', error);
    const courses = loadCoursesFromLocal();
    return courses.find(course => course.id === courseId) || null;
  }
};

export const generateCourseId = (): string => {
  return `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Funciones adicionales para export/import
export const exportCourses = async (): Promise<string> => {
  try {
    return await exportCoursesToJSON();
  } catch (error) {
    console.error('Error exporting courses:', error);
    // Fallback a localStorage
    const courses = loadCoursesFromLocal();
    return JSON.stringify(courses, null, 2);
  }
};

export const importCourses = async (jsonData: string): Promise<boolean> => {
  try {
    return await importCoursesFromJSON(jsonData);
  } catch (error) {
    console.error('Error importing courses:', error);
    return false;
  }
}; 