import React, { useState, useEffect } from 'react';
import { Course, Client, Blackout, Instructor } from '../types';
import { loadCourses, loadClients, loadBlackouts, addBlackout, deleteBlackout, loadInstructors } from '../utils/storage';
import { ChevronLeft, ChevronRight, Calendar, User, DollarSign, Ban, Plus, Clock } from 'lucide-react';
import {
  DEFAULT_COURSE_TIME_ZONE,
  WEEK_CALENDAR_END_HOUR,
  WEEK_CALENDAR_START_HOUR,
  countScheduledCourseDaysInRange,
  courseRunsOnDate,
  getCourseTimeRangeForZone,
  getCourseTimeZoneOptions,
  getCourseWeekdayLabel,
  getWeekCalendarTop,
} from '../utils/courseSchedule';

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
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>('all');
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month');
  const [calendarTimeZone, setCalendarTimeZone] = useState<string>(() => localStorage.getItem('courseCalendarTimeZone') || DEFAULT_COURSE_TIME_ZONE);
  const [calendarTimeZoneSearch, setCalendarTimeZoneSearch] = useState<string>(() => localStorage.getItem('courseCalendarTimeZone') || 'Bogota');
  const calendarTimeZoneOptions = React.useMemo(() => getCourseTimeZoneOptions(calendarTimeZoneSearch, 8), [calendarTimeZoneSearch]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedCourses, loadedClients, loadedBlackouts, loadedInstructors] = await Promise.all([
          loadCourses(),
          loadClients(),
          loadBlackouts(),
          loadInstructors()
        ]);
        setCourses(loadedCourses);
        setClients(loadedClients);
        setBlackouts(loadedBlackouts);
        setInstructors(loadedInstructors);
        
        // Obtener fecha de última actualización
        const storedLastUpdate = localStorage.getItem('lastDataUpdate');
        if (storedLastUpdate) {
          setLastUpdate(storedLastUpdate);
        } else {
          const now = new Date().toISOString();
          setLastUpdate(now);
          localStorage.setItem('lastDataUpdate', now);
        }
    } catch {
      // noop
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
  window.addEventListener('blackoutUpdated', handleBlackoutUpdate as EventListener);
    const handleInstructorUpdate = () => {
      loadInstructors().then(setInstructors);
    };
  window.addEventListener('instructorUpdated', handleInstructorUpdate as EventListener);
    
    return () => {
      window.removeEventListener('azureSyncSuccess', handleSyncSuccess);
      window.removeEventListener('storage', handleStorageChange);
  window.removeEventListener('blackoutUpdated', handleBlackoutUpdate as EventListener);
  window.removeEventListener('instructorUpdated', handleInstructorUpdate as EventListener);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('courseCalendarTimeZone', calendarTimeZone);
  }, [calendarTimeZone]);

  const getClientName = (clientId: string): string => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Cliente no encontrado';
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency
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
    } catch {
      return '';
    }
  };

  // Función para calcular el valor proporcional por día
  const calculateDailyValue = (course: Course): number => {
    const duration = countScheduledCourseDaysInRange(course);
    return duration > 0 ? course.totalValue / duration : 0;
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
  const weekStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  weekStart.setDate(currentDate.getDate() - currentDate.getDay());
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
  const weekDays = Array.from({ length: 7 }, (_, index) => (
    new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index)
  ));
  const hourHeight = 64;
  const weekHours = Array.from(
    { length: WEEK_CALENDAR_END_HOUR - WEEK_CALENDAR_START_HOUR },
    (_, index) => WEEK_CALENDAR_START_HOUR + index,
  );
  const weekGridHeight = (WEEK_CALENDAR_END_HOUR - WEEK_CALENDAR_START_HOUR) * hourHeight;

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

  // Filtrar por instructor si aplica
  const effectiveCourses = selectedInstructorId === 'all' 
    ? courses 
    : courses.filter(c => c.instructorId === selectedInstructorId);

  // Filtrar cursos del mes actual
  const coursesInMonth = effectiveCourses.filter(course => {
    const startDate = createLocalDate(course.startDate);
    const endDate = createLocalDate(course.endDate);
    
    // Normalizar fechas para comparar solo año, mes y día
    const startDateNormalized = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDateNormalized = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    const monthStart = new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), firstDayOfMonth.getDate());
    const monthEnd = new Date(lastDayOfMonth.getFullYear(), lastDayOfMonth.getMonth(), lastDayOfMonth.getDate());
    
    // Verificar si el curso se superpone con el mes actual y tiene dias efectivos en ese mes.
    return (
      startDateNormalized <= monthEnd &&
      endDateNormalized >= monthStart &&
      countScheduledCourseDaysInRange(course, monthStart, monthEnd) > 0
    );
  });

  const coursesInWeek = effectiveCourses.filter(course =>
    countScheduledCourseDaysInRange(course, weekStart, weekEnd) > 0
  );

  const displayedCourses = calendarView === 'week' ? coursesInWeek : coursesInMonth;

  // Obtener cursos para un día específico
  const getCoursesForDay = (day: number) => {
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return coursesInMonth.filter(course => courseRunsOnDate(course, dayDate));
  };

  const getCoursesForWeekDay = (date: Date) => {
    return coursesInWeek
      .filter(course => courseRunsOnDate(course, date))
      .sort((a, b) => getCourseTimeRangeForZone(a, calendarTimeZone, date).startMinutes - getCourseTimeRangeForZone(b, calendarTimeZone, date).startMinutes);
  };

  const getCourseTop = (course: Course, date: Date): number => {
    const startMinutes = getCourseTimeRangeForZone(course, calendarTimeZone, date).startMinutes;
    return getWeekCalendarTop(startMinutes, hourHeight);
  };

  const getCourseHeight = (course: Course, date: Date): number => {
    const range = getCourseTimeRangeForZone(course, calendarTimeZone, date);
    const startMinutes = range.startMinutes;
    const endMinutes = range.endMinutes;
    return Math.max(36, ((Math.max(endMinutes, startMinutes + 30) - startMinutes) / 60) * hourHeight);
  };

  // Días de un curso que caen dentro del mes visible
  const getOverlappingDaysInMonth = (course: Course): number => {
    const monthStart = new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), firstDayOfMonth.getDate());
    const monthEnd = new Date(lastDayOfMonth.getFullYear(), lastDayOfMonth.getMonth(), lastDayOfMonth.getDate());
    return countScheduledCourseDaysInRange(course, monthStart, monthEnd);
  };

  // Valor del mes (prorrateado por días dentro del mes)
  const getMonthlyValueForCourse = (course: Course): number => {
    const daily = calculateDailyValue(course);
    const days = getOverlappingDaysInMonth(course);
    return daily * days;
  };

  const getDisplayedValueForCourse = (course: Course): number => {
    if (calendarView === 'week') {
      return calculateDailyValue(course) * countScheduledCourseDaysInRange(course, weekStart, weekEnd);
    }
    return getMonthlyValueForCourse(course);
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
      if (calendarView === 'week') {
        newDate.setDate(prev.getDate() + (direction === 'prev' ? -7 : 7));
      } else if (direction === 'prev') {
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
  const periodLabel = calendarView === 'week'
    ? `${weekStart.toLocaleDateString('es-ES')} - ${weekEnd.toLocaleDateString('es-ES')}`
    : `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  const selectCalendarTimeZone = (timeZone: string) => {
    setCalendarTimeZone(timeZone);
    setCalendarTimeZoneSearch(timeZone);
  };

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
    <div className="rounded-2xl bg-white p-4 shadow-md sm:p-5">
      {/* Header del calendario (sticky debajo del nav) */}
      <div className="sticky top-16 z-30 -mx-2 mb-5 flex flex-col gap-3 border-b border-gray-100 bg-white px-2 py-2 sm:mx-0 sm:px-0 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div>
            <h2 className="flex items-center text-xl font-bold text-gray-900 sm:text-2xl">
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
              {periodLabel}
            </h3>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 hover:bg-gray-100 rounded-md"
              title="Mes siguiente"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-1">
            <button
              onClick={() => setCalendarView('month')}
              className={`px-3 py-1 text-sm rounded ${calendarView === 'month' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              title="Ver calendario mensual"
            >
              Mes
            </button>
            <button
              onClick={() => setCalendarView('week')}
              className={`px-3 py-1 text-sm rounded ${calendarView === 'week' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              title="Ver calendario semanal por hora"
            >
              Semana
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Instructor:</label>
            <select
              value={selectedInstructorId}
              onChange={(e) => setSelectedInstructorId(e.target.value)}
              className="px-2 py-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Filtrar por instructor"
            >
              <option value="all">Todos</option>
              {instructors.filter(i => i.active).map(inst => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[240px] max-w-full rounded-2xl border border-blue-100 bg-blue-50/60 p-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-blue-800">
              Zona calendario
            </label>
            <input
              type="search"
              value={calendarTimeZoneSearch}
              onChange={(event) => {
                const nextValue = event.target.value;
                setCalendarTimeZoneSearch(nextValue);
                const exact = calendarTimeZoneOptions.find(option => option.value === nextValue || option.label === nextValue);
                if (exact) {
                  setCalendarTimeZone(exact.value);
                }
              }}
              placeholder="Bogota, Madrid, Miami..."
              className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-sm focus:outline-none"
            />
            <div className="mt-2 flex max-w-[420px] gap-1.5 overflow-x-auto pb-1">
              {calendarTimeZoneOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectCalendarTimeZone(option.value)}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    calendarTimeZone === option.value
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-blue-200 bg-white text-blue-800 hover:bg-blue-50'
                  }`}
                  title={option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
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
            <span className="text-xl font-bold text-blue-900">{displayedCourses.length}</span>
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <DollarSign className="h-6 w-6 text-green-600" />
              <span className="ml-2 text-sm font-medium text-green-600">Valor Total</span>
            </div>
            <span className="text-xl font-bold text-green-900">
              {(() => {
                const totalsByCurrency = displayedCourses.reduce((acc, course) => {
                  const currency = course.currency || 'USD';
                  acc[currency] = (acc[currency] || 0) + getDisplayedValueForCourse(course);
                  return acc;
                }, {} as Record<string, number>);

                const currencies = Object.keys(totalsByCurrency);
                if (currencies.length === 0) return formatCurrency(0, 'USD');
                if (currencies.length === 1) {
                  const c = currencies[0];
                  return formatCurrency(totalsByCurrency[c], c);
                }
                return currencies
                  .map(c => formatCurrency(totalsByCurrency[c], c))
                  .join(' / ');
              })()}
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
              {new Set(displayedCourses.map(course => course.clientId)).size}
            </span>
          </div>
        </div>
      </div>

      {/* Calendario */}
      {calendarView === 'month' ? (
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
                      {coursesForDay.slice(0, 3).map(course => {
                        const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                        const displayRange = getCourseTimeRangeForZone(course, calendarTimeZone, dayDate);
                        return (
                        <div
                          key={course.id}
                          onClick={() => onCourseClick && onCourseClick(course)}
                          className={`text-xs p-2 rounded border cursor-pointer hover:shadow-sm transition-shadow ${getStatusColor(course.status)}`}
                          title={`${course.courseName}
Cliente: ${getClientName(course.clientId)}
Fechas: ${course.startDate} - ${course.endDate}
Dias: ${getCourseWeekdayLabel(course.weekdays)}
Horario: ${displayRange.label}
Valor total: ${formatCurrency(course.totalValue, course.currency || 'USD')}
Valor diario: ${formatCurrency(calculateDailyValue(course), course.currency || 'USD')}
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
                            <div className="text-[10px] opacity-75 truncate">
                              {getCourseWeekdayLabel(course.weekdays)}
                            </div>
                            <div className="text-[10px] opacity-75 truncate">
                              {displayRange.label}
                            </div>
                            <div className="text-xs font-bold">
                              {formatCurrency(calculateDailyValue(course), course.currency || 'USD')}/día
                            </div>
                          </div>
                        </div>
                        );
                      })}
                      
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
      ) : (
        <div className="max-h-[75vh] overflow-auto rounded-lg border border-gray-200 bg-white">
          <div className="min-w-[980px]">
            <div className="sticky top-0 z-20 grid grid-cols-[72px_repeat(7,minmax(120px,1fr))] border-b border-gray-200 bg-gray-50">
              <div className="sticky left-0 z-30 bg-gray-50 p-3 text-xs font-medium text-gray-500">Hora</div>
              {weekDays.map(day => {
                const isToday =
                  new Date().toDateString() === day.toDateString();
                return (
                  <div key={day.toISOString()} className={`border-l border-gray-200 p-3 ${isToday ? 'bg-blue-50' : ''}`}>
                    <div className="text-xs font-medium text-gray-500">{dayNames[day.getDay()]}</div>
                    <div className={`text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>
                      {day.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-[72px_repeat(7,minmax(120px,1fr))]">
              <div className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50" style={{ height: weekGridHeight }}>
                {weekHours.map(hour => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-gray-200 px-2 pt-1 text-[11px] text-gray-500"
                    style={{ top: (hour - WEEK_CALENDAR_START_HOUR) * hourHeight }}
                  >
                    {String(hour).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {weekDays.map(day => {
                const dayCourses = getCoursesForWeekDay(day);
                return (
                  <div key={day.toISOString()} className="relative border-r border-gray-200 last:border-r-0" style={{ height: weekGridHeight }}>
                    {weekHours.map(hour => (
                      <div
                        key={hour}
                        className="absolute left-0 right-0 border-t border-gray-100"
                        style={{ top: (hour - WEEK_CALENDAR_START_HOUR) * hourHeight }}
                      />
                    ))}

                    {dayCourses.length === 0 && (
                      <div className="absolute inset-x-2 top-3 text-center text-xs text-gray-400">
                        Sin sesiones
                      </div>
                    )}

                    {dayCourses.map((course, index) => {
	                      const displayRange = getCourseTimeRangeForZone(course, calendarTimeZone, day);
	                      const top = getCourseTop(course, day);
	                      const height = getCourseHeight(course, day);
	                      const overlappingOffset = index % 3;
	                      return (
                        <button
                          key={`${course.id}-${day.toISOString()}`}
                          type="button"
                          onClick={() => onCourseClick && onCourseClick(course)}
                          className={`absolute overflow-hidden rounded-md border p-2 text-left text-xs shadow-sm transition hover:shadow-md ${getStatusColor(course.status)}`}
                          style={{
                            top,
                            height,
                            left: 6 + overlappingOffset * 8,
                            right: 6,
                            zIndex: 10 + index,
                          }}
                          title={`${course.courseName}
Cliente: ${getClientName(course.clientId)}
Horario: ${displayRange.label}
Dias: ${getCourseWeekdayLabel(course.weekdays)}
Estado: ${getStatusText(course.status)}`}
                        >
	                          <div className="flex items-center gap-1 font-semibold">
	                            <Clock size={12} />
	                            <span>{displayRange.label}</span>
	                          </div>
	                          <div className="mt-1 truncate font-medium">{course.courseName}</div>
	                          <div className="truncate opacity-75">{getClientName(course.clientId)}</div>
	                          <div className="mt-1 truncate text-[10px] opacity-75">Vista: {calendarTimeZone}</div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
