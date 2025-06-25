import React, { useState, useEffect } from 'react';
import { Course } from '../types';
import CourseList from './CourseList';
import CourseForm from './CourseForm';
import CourseCalendar from './CourseCalendar';
import { loadCourses, addCourse, updateCourse, deleteCourse } from '../utils/storage';
import { List, Calendar, BookOpen } from 'lucide-react';

const CourseManagement: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');

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

  const handleCourseClick = (course: Course) => {
    // Cambiar a la vista de lista y abrir el formulario de edición
    setActiveTab('list');
    handleEditCourse(course);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header con pestañas */}
        <div className="mb-6">
          <div className="border-b border-gray-200 bg-white rounded-t-lg">
            <nav className="-mb-px flex space-x-8 px-6 pt-4">
              <button
                onClick={() => setActiveTab('list')}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === 'list'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <List className="mr-2" size={18} />
                Lista de Cursos
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === 'calendar'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Calendar className="mr-2" size={18} />
                Vista Calendario
              </button>
            </nav>
          </div>
        </div>

        {/* Contenido según la pestaña activa */}
        {activeTab === 'list' ? (
          <CourseList
            courses={courses}
            onEdit={handleEditCourse}
            onDelete={handleDeleteCourse}
            onAdd={handleAddCourse}
            onRefresh={handleRefresh}
          />
        ) : (
          <CourseCalendar
            onCourseClick={handleCourseClick}
          />
        )}
        
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