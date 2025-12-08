import React, { useState, useEffect, useRef } from 'react';
import { Course, Client, Instructor } from '../types';
import { X, Save, ArrowUp } from 'lucide-react';
import { loadClients, loadInstructors } from '../utils/storage';

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
    hours: 0,
    hourlyRate: 0,
    totalValue: 0,
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Verificar si el curso está pagado para bloquear campos
  const isPaidCourse = isEditing && course?.status === 'pagado';

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
      setFormData(course);
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

  // helper omitido

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // si no hay instructor seleccionado pero existe uno activo por defecto, asignarlo
    if (!formData.instructorId && instructors.length > 0) {
      const preferred = instructors.find(i => i.name.toLowerCase().includes('luis maury') && i.active) || instructors.find(i => i.active) || instructors[0];
      onSave({ ...formData, instructorId: preferred.id });
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div ref={scrollRef} className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Editar Curso' : 'Nuevo Curso'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
            title="Cerrar formulario"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Información del Curso */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
                Información del Curso
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isPaidCourse ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isPaidCourse ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isPaidCourse ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isPaidCourse ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    step="0.0000000001"
                    title={isPaidCourse ? "No se puede editar - Curso pagado" : "Valor por hora del curso (hasta 10 decimales)"}
                    placeholder="Ej: 150.123456789"
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isPaidCourse ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Total
                  </label>
                  <input
                    type="number"
                    name="totalValue"
                    value={formData.totalValue}
                    readOnly
                    title="Valor total calculado automáticamente"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente *
                </label>
                <select
                  name="clientId"
                  value={formData.clientId}
                  onChange={handleInputChange}
                  required
                  disabled={isPaidCourse}
                  title={isPaidCourse ? "No se puede editar - Curso pagado" : "Seleccionar cliente para el curso"}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isPaidCourse ? 'bg-gray-100 cursor-not-allowed' : ''}`}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instructor *
                </label>
                <select
                  name="instructorId"
                  value={formData.instructorId}
                  onChange={handleInputChange}
                  required
                  disabled={isPaidCourse}
                  title={isPaidCourse ? "No se puede editar - Curso pagado" : "Seleccionar instructor para el curso"}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isPaidCourse ? 'bg-gray-100 cursor-not-allowed' : ''}`}
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
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
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