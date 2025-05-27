import React, { useState, useEffect } from 'react';
import { Course } from '../types';
import CourseList from './CourseList';
import CourseForm from './CourseForm';
import { loadCourses, addCourse, updateCourse, deleteCourse } from '../utils/storage';

const CourseManagement: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    // Cargar cursos al montar el componente
    const loadCoursesAsync = async () => {
      const loadedCourses = await loadCourses();
      setCourses(loadedCourses);
    };
    
    loadCoursesAsync();
  }, []);

  const handleAddCourse = () => {
    setEditingCourse(null);
    setIsEditing(false);
    setShowForm(true);
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSaveCourse = async (courseData: Omit<Course, 'id'>) => {
    try {
      if (isEditing && editingCourse) {
        // Actualizar curso existente
        const updatedCourse = await updateCourse(editingCourse.id, courseData);
        if (updatedCourse) {
          setCourses(prev => prev.map(course => 
            course.id === editingCourse.id ? updatedCourse : course
          ));
        }
      } else {
        // Agregar nuevo curso
        const newCourse = await addCourse(courseData);
        if (newCourse) {
          setCourses(prev => [...prev, newCourse]);
        }
      }
      
      setShowForm(false);
      setEditingCourse(null);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving course:', error);
      alert('Error al guardar el curso. Por favor, intenta de nuevo.');
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este curso?')) {
      try {
        const success = await deleteCourse(courseId);
        if (success) {
          setCourses(prev => prev.filter(course => course.id !== courseId));
        } else {
          alert('Error al eliminar el curso.');
        }
      } catch (error) {
        console.error('Error deleting course:', error);
        alert('Error al eliminar el curso. Por favor, intenta de nuevo.');
      }
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingCourse(null);
    setIsEditing(false);
  };

  const handleRefresh = async () => {
    const loadedCourses = await loadCourses();
    setCourses(loadedCourses);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <CourseList
          courses={courses}
          onEdit={handleEditCourse}
          onDelete={handleDeleteCourse}
          onAdd={handleAddCourse}
          onRefresh={handleRefresh}
        />
        
        {showForm && (
          <CourseForm
            course={editingCourse}
            onSave={handleSaveCourse}
            onCancel={handleCancelForm}
            isEditing={isEditing}
          />
        )}
      </div>
    </div>
  );
};

export default CourseManagement; 