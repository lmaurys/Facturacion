import React, { useState, useEffect } from 'react';
import { Course, Client, Blackout } from '../types';
import { loadCourses, loadClients, loadBlackouts, addBlackout, deleteBlackout } from '../utils/storage';
import { ChevronLeft, ChevronRight, Calendar, Clock, User, DollarSign, Ban, Plus } from 'lucide-react';

interface CourseCalendarProps {
  onCourseClick?: (course: Course) => void;
}

const CourseCalendar: React.FC<CourseCalendarProps> = ({ onCourseClick }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [showBlackoutForm, setShowBlackoutForm] = useState(false);
  const [newBlackout, setNewBlackout] = useState<{ startDate: string; endDate: string; reason: string; type: Blackout['type'] }>({ startDate: '', endDate: '', reason: '', type: 'personal' });
  const [showBlackoutList, setShowBlackoutList] = useState(false);
  const [blackoutListTitle, setBlackoutListTitle] = useState('');
  const [blackoutsForDay, setBlackoutsForDay] = useState<Blackout[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedCourses, loadedClients, loadedBlackouts] = await Promise.all([
          loadCourses(),
          loadClients(),
          loadBlackouts()
        ]);
        setCourses(loadedCourses);
        setClients(loadedClients);
        setBlackouts(loadedBlackouts);
        
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
    const handleBlackoutUpdate = () => {
      loadBlackouts().then(setBlackouts);
    };
    window.addEventListener('blackoutUpdated', handleBlackoutUpdate as any);
    
    return () => {
      window.removeEventListener('azureSyncSuccess', handleSyncSuccess);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('blackoutUpdated', handleBlackoutUpdate as any);
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

  // Días de un curso que caen dentro del mes visible
  const getOverlappingDaysInMonth = (course: Course): number => {
    const start = createLocalDate(course.startDate);
    const end = createLocalDate(course.endDate);
    const monthStart = new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), firstDayOfMonth.getDate());
    const monthEnd = new Date(lastDayOfMonth.getFullYear(), lastDayOfMonth.getMonth(), lastDayOfMonth.getDate());
    const overlapStart = start > monthStart ? start : monthStart;
    const overlapEnd = end < monthEnd ? end : monthEnd;
    if (overlapEnd < overlapStart) return 0;
    const diffMs = new Date(overlapEnd.getFullYear(), overlapEnd.getMonth(), overlapEnd.getDate()).getTime() -
                   new Date(overlapStart.getFullYear(), overlapStart.getMonth(), overlapStart.getDate()).getTime();
    // +1 día porque es inclusivo
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  };

  // Valor del mes (prorrateado por días dentro del mes)
  const getMonthlyValueForCourse = (course: Course): number => {
    const daily = calculateDailyValue(course);
    const days = getOverlappingDaysInMonth(course);
    return daily * days;
  };

  // Blackouts del mes actual
  const blackoutsInMonth = blackouts.filter(b => {
    const start = createLocalDate(b.startDate);
    const end = createLocalDate(b.endDate);
    const monthStart = new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), firstDayOfMonth.getDate());
    const monthEnd = new Date(lastDayOfMonth.getFullYear(), lastDayOfMonth.getMonth(), lastDayOfMonth.getDate());
    return start <= monthEnd && end >= monthStart;
  });

  const isDayInBlackout = (day: number): Blackout[] => {
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const d = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
    return blackoutsInMonth.filter(b => {
      const s = createLocalDate(b.startDate);
      const e = createLocalDate(b.endDate);
      const sn = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      const en = new Date(e.getFullYear(), e.getMonth(), e.getDate());
      return d >= sn && d <= en;
    });
  };

  const openBlackoutList = (day: number) => {
    const list = isDayInBlackout(day);
    setBlackoutsForDay(list);
    setBlackoutListTitle(
      `${day} ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    );
    setShowBlackoutList(true);
  };

  const handleDeleteBlackout = async (id: string) => {
    const ok = await deleteBlackout(id);
    if (ok) {
      const latest = await loadBlackouts();
      setBlackouts(latest);
      setBlackoutsForDay(prev => prev.filter(b => b.id !== id));
    }
  };

  const saveNewBlackout = async () => {
    if (!newBlackout.startDate || !newBlackout.endDate || !newBlackout.reason) return;
    const created = await addBlackout({ ...newBlackout });
    if (created) {
      setShowBlackoutForm(false);
      setNewBlackout({ startDate: '', endDate: '', reason: '', type: 'personal' });
      const latest = await loadBlackouts();
      setBlackouts(latest);
    }
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
      {/* Header del calendario (sticky debajo del nav) */}
      <div className="sticky top-16 z-30 bg-white flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 py-2 -mx-2 px-2 sm:mx-0 sm:px-0 border-b border-gray-100">
        <div className="flex items-center space-x-3 sm:space-x-4">
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
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 hover:bg-gray-100 rounded-md"
              title="Mes anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <h3 className="text-base sm:text-xl font-semibold text-gray-800 min-w-[140px] sm:min-w-[200px] text-center">
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
          <button
            onClick={() => setShowBlackoutForm(true)}
            className="px-3 py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 inline-flex items-center w-full sm:w-auto justify-center"
            title="Agregar fecha de bloqueo"
          >
            <Plus size={16} className="mr-1" /> Bloqueo
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
              {formatCurrency(coursesInMonth.reduce((sum, course) => sum + getMonthlyValueForCourse(course), 0))}
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
            const blackoutsForDay = day ? isDayInBlackout(day) : [];
            const isToday = day && 
              new Date().getDate() === day && 
              new Date().getMonth() === currentDate.getMonth() && 
              new Date().getFullYear() === currentDate.getFullYear();

            return (
              <div
                key={index}
                className={`min-h-[110px] p-2 border-r border-b border-gray-200 last:border-r-0 ${
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
                    
                    {blackoutsForDay.length > 0 && (
                      <div className="text-xs p-2 rounded border bg-red-100 border-red-300 text-red-900 flex items-center justify-between">
                        <div className="flex items-center truncate">
                          <Ban size={12} className="mr-1 flex-shrink-0" />
                          <span className="truncate" title={blackoutsForDay.map(b => b.reason).join(' | ')}>
                            Bloqueo{blackoutsForDay.length > 1 ? 's' : ''}: {blackoutsForDay[0].reason}
                          </span>
                        </div>
                        <button
                          className="ml-2 text-xs underline hover:no-underline"
                          onClick={() => openBlackoutList(day)}
                          title="Ver y gestionar bloqueos de este día"
                        >
                          Ver
                        </button>
                      </div>
                    )}

                    <div className="space-y-1 mt-1">
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
Estado: ${getStatusText(course.status)}${course.observations ? `\nObservaciones: ${course.observations}` : ''}`}
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

      {showBlackoutForm && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md">
            <h4 className="text-lg font-semibold mb-3 flex items-center">
              <Ban className="mr-2" /> Nueva Fecha de Bloqueo
            </h4>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="blk-start" className="text-sm text-gray-700">Desde</label>
                  <input id="blk-start" type="date" className="w-full border rounded px-2 py-1" title="Fecha de inicio del bloqueo" value={newBlackout.startDate} onChange={e => setNewBlackout(v => ({ ...v, startDate: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="blk-end" className="text-sm text-gray-700">Hasta</label>
                  <input id="blk-end" type="date" className="w-full border rounded px-2 py-1" title="Fecha de fin del bloqueo" value={newBlackout.endDate} onChange={e => setNewBlackout(v => ({ ...v, endDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label htmlFor="blk-reason" className="text-sm text-gray-700">Motivo</label>
                <input id="blk-reason" type="text" className="w-full border rounded px-2 py-1" placeholder="Vacaciones, viaje, indisponibilidad..." title="Motivo del bloqueo" value={newBlackout.reason} onChange={e => setNewBlackout(v => ({ ...v, reason: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="blk-type" className="text-sm text-gray-700">Tipo</label>
                <select id="blk-type" className="w-full border rounded px-2 py-1" title="Tipo de bloqueo" value={newBlackout.type} onChange={e => setNewBlackout(v => ({ ...v, type: e.target.value as Blackout['type'] }))}>
                  <option value="personal">Personal</option>
                  <option value="holiday">Festivo</option>
                  <option value="travel">Viaje</option>
                  <option value="other">Otro</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button className="px-3 py-1 rounded bg-gray-100" onClick={() => setShowBlackoutForm(false)}>Cancelar</button>
              <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={saveNewBlackout}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {showBlackoutList && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md">
            <h4 className="text-lg font-semibold mb-3 flex items-center">
              <Ban className="mr-2" /> Bloqueos del {blackoutListTitle}
            </h4>
            {blackoutsForDay.length === 0 ? (
              <div className="text-sm text-gray-600">No hay bloqueos en este día.</div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-auto">
                {blackoutsForDay.map(b => (
                  <div key={b.id} className="p-2 border rounded flex items-start justify-between">
                    <div className="text-sm">
                      <div className="font-medium text-red-700">{b.reason}</div>
                      <div className="text-gray-600 text-xs">{b.startDate} → {b.endDate} • {b.type}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteBlackout(b.id)}
                      className="ml-3 px-2 py-1 text-xs bg-red-600 text-white rounded"
                      title="Eliminar bloqueo"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button className="px-3 py-1 rounded bg-gray-100" onClick={() => setShowBlackoutList(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

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