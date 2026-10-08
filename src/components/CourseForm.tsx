import React, { useState, useEffect, useRef } from 'react';
import { Course, Client, Currency, Instructor, supportedCurrencies } from '../types';
import { X, Save, ArrowUp, Calendar, CalendarX2, Plus } from 'lucide-react';
import { loadClients, loadInstructors } from '../utils/storage';
import { formatDate } from '../utils/dateUtils';
import {
  COURSE_WEEKDAYS,
  COURSE_WEEKDAY_VALUES,
  DEFAULT_COURSE_END_TIME,
  DEFAULT_COURSE_START_TIME,
  DEFAULT_COURSE_TIME_ZONE,
  getCourseTimeZoneOptions,
  getCourseWeekdayLabel,
  isValidCourseTime,
  normalizeCourseExcludedDates,
  normalizeCourseWeekdays,
  parseTimeToMinutes,
  resolveCourseTimeZoneInput,
} from '../utils/courseSchedule';

interface CourseFormProps {
  course?: Course | null;
  onSave: (course: Omit<Course, 'id'>) => void;
  onCancel: () => void;
  isEditing: boolean;
}

const CourseForm: React.FC<CourseFormProps> = ({ course, onSave, onCancel, isEditing }) => {
  const [formData, setFormData] = useState<Omit<Course, 'id'>>({
    courseName: '',
    startDate: '',
    endDate: '',
    weekdays: [...COURSE_WEEKDAY_VALUES],
    excludedDates: [],
    startTime: DEFAULT_COURSE_START_TIME,
    endTime: DEFAULT_COURSE_END_TIME,
    timeZone: DEFAULT_COURSE_TIME_ZONE,
    hours: 0,
    hourlyRate: 0,
    totalValue: 0,
    currency: 'USD',
    clientId: '',
    instructorId: '',
    invoiceNumber: '',
    invoiceDate: '',
    status: 'creado',
    paymentDate: '',
    paidAmount: 0,
    observations: ''
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [timeZoneSearch, setTimeZoneSearch] = useState('Bogota');
  const [excludedDate, setExcludedDate] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Verificar si el curso está pagado para bloquear campos
  const isPaidCourse = isEditing && course?.status === 'pagado';
  const getSelectedWeekdays = (weekdays?: number[]) => Array.isArray(weekdays) ? weekdays : [...COURSE_WEEKDAY_VALUES];
  const filteredTimeZones = React.useMemo(() => getCourseTimeZoneOptions(timeZoneSearch, 10), [timeZoneSearch]);

  useEffect(() => {
    // Cargar clientes al montar el componente
    const loadClientsAsync = async () => {
      const loadedClients = await loadClients();
      setClients(loadedClients);
    };
    const loadInstructorsAsync = async () => {
      const loadedInstructors = await loadInstructors();
      setInstructors(loadedInstructors);
    };
    loadClientsAsync();
    loadInstructorsAsync();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 300);
    onScroll();
  el.addEventListener('scroll', onScroll, { passive: true } as AddEventListenerOptions);
  return () => el.removeEventListener('scroll', onScroll as EventListener);
  }, []);

  useEffect(() => {
    if (course) {
      const { id: courseId, ...editableCourse } = course;
      void courseId;
      setFormData({
        ...editableCourse,
        currency: (course.currency || 'USD') as Currency,
        weekdays: normalizeCourseWeekdays(course.weekdays),
        excludedDates: normalizeCourseExcludedDates(course.excludedDates),
        startTime: course.startTime || DEFAULT_COURSE_START_TIME,
        endTime: course.endTime || DEFAULT_COURSE_END_TIME,
        timeZone: course.timeZone || DEFAULT_COURSE_TIME_ZONE,
      });
      setTimeZoneSearch(course.timeZone || 'Bogota');
    }
  }, [course]);

  useEffect(() => {
    // Calcular valor total automáticamente
    const total = formData.hours * formData.hourlyRate;
    setFormData(prev => ({ ...prev, totalValue: total }));
  }, [formData.hours, formData.hourlyRate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const toggleWeekday = (weekday: number) => {
    if (isPaidCourse) return;

    setFormData(prev => {
      const selected = getSelectedWeekdays(prev.weekdays);
      const next = selected.includes(weekday)
        ? selected.filter(day => day !== weekday)
        : [...selected, weekday].sort((a, b) => a - b);

      return { ...prev, weekdays: next };
    });
  };

  const selectAllWeekdays = () => {
    if (isPaidCourse) return;
    setFormData(prev => ({ ...prev, weekdays: [...COURSE_WEEKDAY_VALUES] }));
  };

  const addExcludedDate = () => {
    if (isPaidCourse || !excludedDate) return;

    if (!formData.startDate || !formData.endDate || excludedDate < formData.startDate || excludedDate > formData.endDate) {
      alert('La fecha sin clase debe estar dentro del rango del curso.');
      return;
    }

    const date = new Date(`${excludedDate}T00:00:00`);
    if (!getSelectedWeekdays(formData.weekdays).includes(date.getDay())) {
      alert('Esa fecha no corresponde a uno de los días de clase seleccionados.');
      return;
    }

    const current = normalizeCourseExcludedDates(formData.excludedDates);
    if (current.includes(excludedDate)) {
      alert('Esta fecha ya está marcada como día sin clase.');
      return;
    }

    setFormData(prev => ({
      ...prev,
      excludedDates: [...current, excludedDate].sort(),
    }));
    setExcludedDate('');
  };

  const removeExcludedDate = (date: string) => {
    if (isPaidCourse) return;
    setFormData(prev => ({
      ...prev,
      excludedDates: normalizeCourseExcludedDates(prev.excludedDates).filter(item => item !== date),
    }));
  };

  const selectTimeZone = (timeZone: string) => {
    if (isPaidCourse) return;
    setFormData(prev => ({ ...prev, timeZone }));
    setTimeZoneSearch(timeZone);
  };

  // helper omitido

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedTimeZone = resolveCourseTimeZoneInput(timeZoneSearch, formData.timeZone || DEFAULT_COURSE_TIME_ZONE);
    if (!resolvedTimeZone) {
      alert('Selecciona una zona horaria valida. Puedes buscar por ciudad, pais o codigo IANA.');
      return;
    }

    const weekdays = getSelectedWeekdays(formData.weekdays);
    if (weekdays.length === 0) {
      alert('Selecciona al menos un dia de la semana para el curso.');
      return;
    }

    if (!isValidCourseTime(formData.startTime) || !isValidCourseTime(formData.endTime)) {
      alert('Usa formato de hora HH:mm, por ejemplo 08:00.');
      return;
    }

    if (parseTimeToMinutes(formData.endTime) <= parseTimeToMinutes(formData.startTime)) {
      alert('La hora de finalizacion debe ser posterior a la hora de inicio.');
      return;
    }

    const excludedDates = normalizeCourseExcludedDates(formData.excludedDates).filter(date => {
      const localDate = new Date(`${date}T00:00:00`);
      return date >= formData.startDate && date <= formData.endDate && weekdays.includes(localDate.getDay());
    });
    const courseToSave = { ...formData, weekdays, excludedDates, timeZone: resolvedTimeZone };

    // si no hay instructor seleccionado pero existe uno activo por defecto, asignarlo
    if (!formData.instructorId && instructors.length > 0) {
      const preferred = instructors.find(i => i.active) || instructors[0];
      onSave({ ...courseToSave, instructorId: preferred.id });
      return;
    }
    onSave(courseToSave);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-2 sm:p-4">
      <div ref={scrollRef} className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl shadow-slate-950/20">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Cursos</p>
            <h2 className="text-lg font-semibold text-slate-950 sm:text-xl">
              {isEditing ? 'Editar curso' : 'Nuevo curso'}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="Cerrar formulario"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5">
          {isPaidCourse && (
            <div className="mb-6 bg-amber-50 border border-amber-300 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-amber-800">
                    Curso Pagado - Edición Limitada
                  </h3>
                  <div className="mt-2 text-sm text-amber-700">
                    <p>Este curso ya ha sido pagado. Solo puedes cambiar el <strong>estado</strong> del curso.</p>
                    <p className="mt-1">Todos los demás campos están bloqueados para proteger la integridad de los registros financieros.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Información del Curso */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <h3 className="border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">
                Información del Curso
              </h3>
              
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Curso Dictado *
                </label>
                <input
                  type="text"
                  name="courseName"
                  value={formData.courseName}
                  onChange={handleInputChange}
                  required
                  disabled={isPaidCourse}
                  title={isPaidCourse ? "No se puede editar - Curso pagado" : "Nombre del curso dictado"}
                  placeholder="Ej: Cisco CCNA Security"
                  className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none ${isPaidCourse ? 'cursor-not-allowed bg-slate-100' : ''}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Fecha Inicial *
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    required
                    disabled={isPaidCourse}
                    title={isPaidCourse ? "No se puede editar - Curso pagado" : "Fecha de inicio del curso"}
                    className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none ${isPaidCourse ? 'cursor-not-allowed bg-slate-100' : ''}`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Fecha Final *
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    required
                    disabled={isPaidCourse}
                    title={isPaidCourse ? "No se puede editar - Curso pagado" : "Fecha final del curso"}
                    className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none ${isPaidCourse ? 'cursor-not-allowed bg-slate-100' : ''}`}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Días de clase *
                  </label>
                  <button
                    type="button"
                    onClick={selectAllWeekdays}
                    disabled={isPaidCourse}
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      isPaidCourse
                        ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'border-blue-200 text-blue-700 hover:bg-blue-50'
                    }`}
                    title="Seleccionar todos los días"
                  >
                    <Calendar size={13} className="mr-1" />
                    Todos
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {COURSE_WEEKDAYS.map(day => {
                    const selected = getSelectedWeekdays(formData.weekdays).includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleWeekday(day.value)}
                        disabled={isPaidCourse}
                        aria-pressed={selected}
                        className={`rounded-xl border px-2 py-2 text-xs font-semibold transition sm:text-sm ${
                          selected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        } ${isPaidCourse ? 'cursor-not-allowed opacity-70' : ''}`}
                        title={day.label}
                      >
                        {day.shortLabel}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Se programará en: {getSelectedWeekdays(formData.weekdays).length > 0 ? getCourseWeekdayLabel(formData.weekdays) : 'Ningún día seleccionado'}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <CalendarX2 size={16} className="text-amber-700" />
                  <label className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                    Fechas sin clase
                  </label>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="date"
                    value={excludedDate}
                    min={formData.startDate || undefined}
                    max={formData.endDate || undefined}
                    onChange={event => setExcludedDate(event.target.value)}
                    disabled={isPaidCourse || !formData.startDate || !formData.endDate}
                    title="Fecha específica que no tendrá clase"
                    className={`min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none ${isPaidCourse ? 'cursor-not-allowed bg-slate-100' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={addExcludedDate}
                    disabled={isPaidCourse || !excludedDate}
                    className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={15} className="mr-1" />
                    Omitir fecha
                  </button>
                </div>
                {normalizeCourseExcludedDates(formData.excludedDates).length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {normalizeCourseExcludedDates(formData.excludedDates).map(date => (
                      <span key={date} className="inline-flex items-center rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-900">
                        {formatDate(date)}
                        <button
                          type="button"
                          onClick={() => removeExcludedDate(date)}
                          disabled={isPaidCourse}
                          className="ml-2 rounded-full text-amber-600 hover:text-red-600 disabled:cursor-not-allowed"
                          aria-label={`Restaurar clase del ${formatDate(date)}`}
                          title="Quitar esta excepción"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-800">Agrega aquí festivos o fechas específicas en las que este curso no tendrá clase.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Hora inicio *
                  </label>
                  <input
                    type="time"
                    step="60"
                    name="startTime"
                    value={formData.startTime || DEFAULT_COURSE_START_TIME}
                    onChange={handleInputChange}
                    required
                    disabled={isPaidCourse}
                    title={isPaidCourse ? "No se puede editar - Curso pagado" : "Hora de inicio de cada sesion"}
                    placeholder="08:00"
                    className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none ${isPaidCourse ? 'cursor-not-allowed bg-slate-100' : ''}`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Hora finalizacion *
                  </label>
                  <input
                    type="time"
                    step="60"
                    name="endTime"
                    value={formData.endTime || DEFAULT_COURSE_END_TIME}
                    onChange={handleInputChange}
                    required
                    disabled={isPaidCourse}
                    title={isPaidCourse ? "No se puede editar - Curso pagado" : "Hora de finalizacion de cada sesion"}
                    placeholder="17:00"
                    className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none ${isPaidCourse ? 'cursor-not-allowed bg-slate-100' : ''}`}
                  />
                </div>
	                <div className="col-span-2 rounded-2xl border border-blue-100 bg-white p-3">
	                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
	                    Zona horaria *
	                  </label>
	                  <input
	                    type="search"
	                    value={timeZoneSearch}
	                    onChange={(event) => {
                        const nextValue = event.target.value;
                        setTimeZoneSearch(nextValue);
                        const resolved = resolveCourseTimeZoneInput(nextValue);
                        if (resolved) {
                          setFormData(prev => ({ ...prev, timeZone: resolved }));
                        }
                      }}
	                    required
	                    disabled={isPaidCourse}
	                    title={isPaidCourse ? "No se puede editar - Curso pagado" : "Busca por ciudad, pais o zona IANA"}
	                    placeholder="Ej: Bogota, Madrid, Miami, Mexico..."
	                    className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none ${isPaidCourse ? 'cursor-not-allowed bg-slate-100' : ''}`}
	                  />
                    <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {filteredTimeZones.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => selectTimeZone(option.value)}
                          disabled={isPaidCourse}
                          className={`truncate rounded-full border px-3 py-1.5 text-left text-xs font-semibold transition ${
                            formData.timeZone === option.value
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-white'
                          } ${isPaidCourse ? 'cursor-not-allowed opacity-70' : ''}`}
                          title={option.value}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Zona seleccionada: <span className="font-semibold text-slate-700">{formData.timeZone || DEFAULT_COURSE_TIME_ZONE}</span>
                    </p>
	                </div>
	              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Número de Horas *
                  </label>
                  <input
                    type="number"
                    name="hours"
                    value={formData.hours}
                    onChange={handleInputChange}
                    required
                    disabled={isPaidCourse}
                    min="0"
                    step="0.01"
                    title={isPaidCourse ? "No se puede editar - Curso pagado" : "Número total de horas del curso (hasta 2 decimales)"}
                    placeholder="Ej: 40.25"
                    className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none ${isPaidCourse ? 'cursor-not-allowed bg-slate-100' : ''}`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Valor/Hora *
                  </label>
                  <input
                    type="number"
                    name="hourlyRate"
                    value={formData.hourlyRate}
                    onChange={handleInputChange}
                    required
                    disabled={isPaidCourse}
                    min="0"
                    step="0.001"
                    title={isPaidCourse ? "No se puede editar - Curso pagado" : "Valor por hora del curso (hasta 3 decimales)"}
                    placeholder="Ej: 28.125"
                    className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none ${isPaidCourse ? 'cursor-not-allowed bg-slate-100' : ''}`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Valor Total
                  </label>
                  <input
                    type="number"
                    name="totalValue"
                    value={formData.totalValue}
                    readOnly
                    title="Valor total calculado automáticamente"
                    className="w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Moneda
                </label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                  disabled={isPaidCourse}
                  title={isPaidCourse ? 'No se puede editar - Curso pagado' : 'Moneda del curso'}
                  className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none ${isPaidCourse ? 'cursor-not-allowed bg-slate-100' : ''}`}
                >
                  {supportedCurrencies.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Cliente *
                </label>
                <select
                  name="clientId"
                  value={formData.clientId}
                  onChange={handleInputChange}
                  required
                  disabled={isPaidCourse}
                  title={isPaidCourse ? "No se puede editar - Curso pagado" : "Seleccionar cliente para el curso"}
                  className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none ${isPaidCourse ? 'cursor-not-allowed bg-slate-100' : ''}`}
                >
                  <option value="">Seleccionar cliente</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
                {clients.length === 0 && (
                  <p className="mt-1 text-sm text-gray-500">
                    No hay clientes registrados. Primero agrega clientes en la sección de Gestión de Clientes.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Instructor *
                </label>
                <select
                  name="instructorId"
                  value={formData.instructorId}
                  onChange={handleInputChange}
                  required
                  disabled={isPaidCourse}
                  title={isPaidCourse ? "No se puede editar - Curso pagado" : "Seleccionar instructor para el curso"}
                  className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none ${isPaidCourse ? 'cursor-not-allowed bg-slate-100' : ''}`}
                >
                  <option value="">Seleccionar instructor</option>
                  {instructors.filter(i => i.active).map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
                {instructors.length === 0 && (
                  <p className="mt-1 text-sm text-gray-500">
                    No hay instructores registrados. Agrega instructores en la sección de Gestión de Datos.
                  </p>
                )}
              </div>
            </div>

            {/* Estado y Observaciones */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">
                Estado y Observaciones
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado *
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  required
                  title="Estado actual del curso"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="creado">Creado</option>
                  <option value="dictado">Dictado</option>
                  <option value="facturado">Facturado</option>
                  <option value="pagado">Pagado</option>
                </select>
              </div>

              {/* Información de Facturación */}
              {(formData.status === 'facturado' || formData.status === 'pagado') && (
                <div className="border-t pt-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">
                    Información de Facturación
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Número de Factura
                      </label>
                      <input
                        type="text"
                        name="invoiceNumber"
                        value={formData.invoiceNumber}
                        onChange={handleInputChange}
                        disabled={isPaidCourse}
                        title={isPaidCourse ? "No se puede editar - Curso pagado" : "Número de la factura asociada"}
                        placeholder="Ej: LP115"
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isPaidCourse ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha de Factura
                      </label>
                      <input
                        type="date"
                        name="invoiceDate"
                        value={formData.invoiceDate}
                        onChange={handleInputChange}
                        disabled={isPaidCourse}
                        title={isPaidCourse ? "No se puede editar - Curso pagado" : "Fecha de emisión de la factura"}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isPaidCourse ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {formData.status === 'pagado' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de Pago
                    </label>
                    <input
                      type="date"
                      name="paymentDate"
                      value={formData.paymentDate}
                      onChange={handleInputChange}
                      disabled={isPaidCourse}
                      title={isPaidCourse ? "No se puede editar - Curso pagado" : "Fecha en que se recibió el pago"}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isPaidCourse ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monto Pagado
                    </label>
                    <input
                      type="number"
                      name="paidAmount"
                      value={formData.paidAmount}
                      onChange={handleInputChange}
                      disabled={isPaidCourse}
                      min="0"
                      step="0.01"
                      title={isPaidCourse ? "No se puede editar - Curso pagado" : "Monto total recibido"}
                      placeholder="0.00"
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isPaidCourse ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  name="observations"
                  value={formData.observations}
                  onChange={handleInputChange}
                  disabled={isPaidCourse}
                  rows={4}
                  title={isPaidCourse ? "No se puede editar - Curso pagado" : "Observaciones adicionales"}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isPaidCourse ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="mt-8 flex justify-end space-x-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
            >
              <Save className="mr-2" size={16} />
              {isEditing ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>

        {showScrollTop && (
          <button
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Volver arriba"
            title="Volver arriba"
            className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ArrowUp size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default CourseForm;
