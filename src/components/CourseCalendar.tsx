import React, { useState, useEffect } from 'react';
import { Course, Client } from '../types';
import { loadCourses, loadClients } from '../utils/storage';
import { ChevronLeft, ChevronRight, Calendar, Clock, User, DollarSign } from 'lucide-react';

interface CourseCalendarProps {
  onCourseClick?: (course: Course) => void;
}

const CourseCalendar: React.FC<CourseCalendarProps> = ({ onCourseClick }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedCourses, loadedClients] = await Promise.all([
          loadCourses(),
          loadClients()
        ]);
        setCourses(loadedCourses);
        setClients(loadedClients);
        
        // Obtener fecha de última actualización
        const storedLastUpdate = localStorage.getItem('lastDataUpdate');
        if (storedLastUpdate) {
          setLastUpdate(storedLastUpdate);
        } else {
          const now = new Date().toISOString();
          setLastUpdate(now);
          localStorage.setItem('lastDataUpdate', now);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    
    // Escuchar eventos de sincronización para actualizar la fecha
    const handleSyncSuccess = () => {
      updateLastUpdateTime();
    };

    // Escuchar cambios en el storage para actualizar la fecha
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lastDataUpdate') {
        setLastUpdate(e.newValue || '');
      }
    };

    window.addEventListener('azureSyncSuccess', handleSyncSuccess);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('azureSyncSuccess', handleSyncSuccess);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const getClientName = (clientId: string): string => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Cliente no encontrado';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatLastUpdate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '';
    }
  };

  // Función para calcular la duración del curso en días
  const calculateCourseDuration = (startDate: string, endDate: string): number => {
    const start = createLocalDate(startDate);
    const end = createLocalDate(endDate);
    const timeDiff = end.getTime() - start.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    return daysDiff + 1; // +1 porque incluye tanto el día de inicio como el de fin
  };

  // Función para calcular el valor proporcional por día
  const calculateDailyValue = (course: Course): number => {
    const duration = calculateCourseDuration(course.startDate, course.endDate);
    return course.totalValue / duration;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'creado': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'dictado': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'facturado': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pagado': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'creado': return 'Creado';
      case 'dictado': return 'Dictado';
      case 'facturado': return 'Facturado';
      case 'pagado': return 'Pagado';
      default: return status;
    }
  };

  // Obtener el primer día del mes
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  // Obtener el último día del mes
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  // Obtener el primer día de la semana para el calendario (domingo = 0)
  const firstDayOfWeek = firstDayOfMonth.getDay();
  // Obtener el número de días en el mes
  const daysInMonth = lastDayOfMonth.getDate();

  // Crear array de días para el calendario
  const calendarDays = [];
  
  // Agregar días vacíos al inicio
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null);
  }
  
  // Agregar días del mes
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Función auxiliar para crear fecha local desde string YYYY-MM-DD
  const createLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month - 1 porque los meses en JS van de 0-11
  };

  // Filtrar cursos del mes actual
  const coursesInMonth = courses.filter(course => {
    const startDate = createLocalDate(course.startDate);
    const endDate = createLocalDate(course.endDate);
    
    // Normalizar fechas para comparar solo año, mes y día
    const startDateNormalized = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDateNormalized = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    const monthStart = new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), firstDayOfMonth.getDate());
    const monthEnd = new Date(lastDayOfMonth.getFullYear(), lastDayOfMonth.getMonth(), lastDayOfMonth.getDate());
    
    // Verificar si el curso se superpone con el mes actual (inclusive)
    return (startDateNormalized <= monthEnd && endDateNormalized >= monthStart);
  });

  // Obtener cursos para un día específico
  const getCoursesForDay = (day: number) => {
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    // Normalizar la fecha para comparar solo año, mes y día (sin horas)
    const dayDateNormalized = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
    
    return coursesInMonth.filter(course => {
      const startDate = createLocalDate(course.startDate);
      const endDate = createLocalDate(course.endDate);
      
      // Normalizar las fechas del curso para comparar solo año, mes y día
      const startDateNormalized = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const endDateNormalized = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      
      // Verificar si el día está dentro del rango del curso (inclusive)
      return dayDateNormalized >= startDateNormalized && dayDateNormalized <= endDateNormalized;
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const updateLastUpdateTime = () => {
    const now = new Date().toISOString();
    setLastUpdate(now);
    localStorage.setItem('lastDataUpdate', now);
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  if (loading) {
    return (
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      {/* Header del calendario */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Calendar className="mr-3" size={24} />
              Calendario de Cursos
            </h2>
            {lastUpdate && (
              <p className="text-sm text-gray-500 mt-1">
                Última actualización: {formatLastUpdate(lastUpdate)}
              </p>
            )}
          </div>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200"
          >
            Hoy
          </button>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 hover:bg-gray-100 rounded-md"
            title="Mes anterior"
          >
            <ChevronLeft size={20} />
          </button>
          
          <h3 className="text-xl font-semibold text-gray-800 min-w-[200px] text-center">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 hover:bg-gray-100 rounded-md"
            title="Mes siguiente"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Resumen del mes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Calendar className="h-6 w-6 text-blue-600" />
              <span className="ml-2 text-sm font-medium text-blue-600">Cursos</span>
            </div>
            <span className="text-xl font-bold text-blue-900">{coursesInMonth.length}</span>
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <DollarSign className="h-6 w-6 text-green-600" />
              <span className="ml-2 text-sm font-medium text-green-600">Valor Total</span>
            </div>
            <span className="text-xl font-bold text-green-900">
              {formatCurrency(coursesInMonth.reduce((sum, course) => sum + course.totalValue, 0))}
            </span>
          </div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <User className="h-6 w-6 text-purple-600" />
              <span className="ml-2 text-sm font-medium text-purple-600">Clientes</span>
            </div>
            <span className="text-xl font-bold text-purple-900">
              {new Set(coursesInMonth.map(course => course.clientId)).size}
            </span>
          </div>
        </div>
      </div>

      {/* Calendario */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Encabezados de días */}
        <div className="grid grid-cols-7 bg-gray-50">
          {dayNames.map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-700 border-r border-gray-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Días del calendario */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const coursesForDay = day ? getCoursesForDay(day) : [];
            const isToday = day && 
              new Date().getDate() === day && 
              new Date().getMonth() === currentDate.getMonth() && 
              new Date().getFullYear() === currentDate.getFullYear();

            return (
              <div
                key={index}
                className={`min-h-[100px] p-2 border-r border-b border-gray-200 last:border-r-0 ${
                  day ? 'bg-white hover:bg-gray-50' : 'bg-gray-50'
                } ${isToday ? 'bg-blue-50' : ''}`}
              >
                {day && (
                  <>
                    <div className={`text-sm font-medium mb-2 ${
                      isToday ? 'text-blue-600 font-bold' : 'text-gray-900'
                    }`}>
                      {day}
                      {isToday && (
                        <span className="ml-1 text-xs bg-blue-600 text-white px-1 rounded">
                          Hoy
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      {coursesForDay.slice(0, 3).map(course => (
                        <div
                          key={course.id}
                          onClick={() => onCourseClick && onCourseClick(course)}
                          className={`text-xs p-2 rounded border cursor-pointer hover:shadow-sm transition-shadow ${getStatusColor(course.status)}`}
                          title={`${course.courseName}
Cliente: ${getClientName(course.clientId)}
Fechas: ${course.startDate} - ${course.endDate}
Valor total: ${formatCurrency(course.totalValue)}
Valor diario: ${formatCurrency(calculateDailyValue(course))}
Estado: ${getStatusText(course.status)}`}
                        >
                          <div className="font-medium truncate mb-1">
                            {course.courseName}
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate opacity-75 flex-1 mr-2">
                              {getClientName(course.clientId)}
                            </span>
                            <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                              course.status === 'pagado' ? 'bg-green-200 text-green-800' :
                              course.status === 'facturado' ? 'bg-blue-200 text-blue-800' :
                              course.status === 'dictado' ? 'bg-yellow-200 text-yellow-800' :
                              'bg-gray-200 text-gray-800'
                            }`}>
                              {course.status === 'pagado' ? 'P' :
                               course.status === 'facturado' ? 'F' :
                               course.status === 'dictado' ? 'D' : 'C'}
                            </span>
                          </div>
                          <div className="text-right mt-1">
                            <div className="text-xs font-bold">
                              {formatCurrency(calculateDailyValue(course))}/día
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {coursesForDay.length > 3 && (
                        <div className="text-xs text-gray-500 text-center py-1">
                          +{coursesForDay.length - 3} más...
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Leyenda */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold text-gray-900 mb-3">Estados de Cursos:</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center">
            <span className="w-6 h-6 rounded bg-gray-200 text-gray-800 text-xs font-medium flex items-center justify-center mr-2">C</span>
            <span className="text-sm text-gray-700">Creado</span>
          </div>
          <div className="flex items-center">
            <span className="w-6 h-6 rounded bg-yellow-200 text-yellow-800 text-xs font-medium flex items-center justify-center mr-2">D</span>
            <span className="text-sm text-gray-700">Dictado</span>
          </div>
          <div className="flex items-center">
            <span className="w-6 h-6 rounded bg-blue-200 text-blue-800 text-xs font-medium flex items-center justify-center mr-2">F</span>
            <span className="text-sm text-gray-700">Facturado</span>
          </div>
          <div className="flex items-center">
            <span className="w-6 h-6 rounded bg-green-200 text-green-800 text-xs font-medium flex items-center justify-center mr-2">P</span>
            <span className="text-sm text-gray-700">Pagado</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseCalendar; 