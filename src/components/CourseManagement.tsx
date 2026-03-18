import React, { useState, useEffect } from 'react';
import { Course } from '../types';
import CourseList from './CourseList';
import CourseForm from './CourseForm';
import CourseCalendar from './CourseCalendar';
import { loadCourses, addCourse, updateCourse, deleteCourse } from '../utils/storage';
import { List, Calendar } from 'lucide-react';

const CourseManagement: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');

  useEffect(() => {
    // Cargar cursos al montar el componente
    const loadCoursesAsync = async () => {
      console.log('📚 Cargando cursos...');
      const loadedCourses = await loadCourses();
      console.log('📊 Cursos cargados:', loadedCourses.length);
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
      console.log('🔄 Guardando curso:', courseData.courseName);
      console.log('📊 Estado actual de cursos:', courses.length);
      
      if (isEditing && editingCourse) {
        // Actualizar curso existente
        console.log('✏️ Actualizando curso existente:', editingCourse.id);
        const updatedCourse = await updateCourse(editingCourse.id, courseData);
        if (updatedCourse) {
          setCourses(prev => prev.map(course => 
            course.id === editingCourse.id ? updatedCourse : course
          ));
          console.log('✅ Curso actualizado exitosamente');
        } else {
          console.error('❌ Error: updateCourse retornó null');
        }
      } else {
        // Agregar nuevo curso
        console.log('🆕 Agregando nuevo curso...');
        const newCourse = await addCourse(courseData);
        if (newCourse) {
          console.log('✅ Curso creado exitosamente:', newCourse.id);
          setCourses(prev => {
            const updatedCourses = [...prev, newCourse];
            console.log('📈 Cursos en el estado local:', updatedCourses.length);
            return updatedCourses;
          });
        } else {
          console.error('❌ Error: addCourse retornó null');
          alert('Error al crear el curso. Verifica que todos los campos estén completos.');
          return;
        }
      }
      
      setShowForm(false);
      setEditingCourse(null);
      setIsEditing(false);
      
      console.log('✅ Proceso de guardado completado');
    } catch (error) {
      console.error('❌ Error saving course:', error);
      alert('Error al guardar el curso. Por favor, intenta de nuevo.');
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    // Verificar el estado del curso
    const course = courses.find(c => c.id === courseId);
    if (course && course.status !== 'creado') {
      const statusNames: Record<string, string> = {
        'dictado': 'Dictado',
        'facturado': 'Facturado',
        'pagado': 'Pagado'
      };
      const statusName = statusNames[course.status] || course.status;
      alert(`⚠️ ERROR: Solo se pueden eliminar cursos en estado "Creado".\n\n` +
            `Estado actual: ${statusName}\n\n` +
            `Los cursos que ya han sido dictados, facturados o pagados no pueden eliminarse.\n` +
            `Si necesitas hacer cambios, edita el curso en lugar de eliminarlo.`);
      return;
    }

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

  const handleCourseClick = (course: Course) => {
    // Cambiar a la vista de lista y abrir el formulario de edición
    setActiveTab('list');
    handleEditCourse(course);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
        {/* Header con pestañas */}
        <div className="mb-6">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="px-4 pt-4 sm:px-6">
              <nav className="-mb-px flex overflow-x-auto whitespace-nowrap">
                <button
                  onClick={() => setActiveTab('list')}
                  className={`mr-6 flex items-center border-b-2 px-1 py-2 text-sm font-medium ${
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
                  className={`flex items-center border-b-2 px-1 py-2 text-sm font-medium ${
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
        </div>

        {/* Contenido según la pestaña activa */}
        {activeTab === 'list' ? (
          <CourseList
            courses={courses}
            onEdit={handleEditCourse}
            onDelete={handleDeleteCourse}
            onAdd={handleAddCourse}
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
  );
};

export default CourseManagement; 
