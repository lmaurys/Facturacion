import React, { useState, useEffect } from 'react';
import { Course, Client, Item } from '../types';
import { loadCourses, loadClients, getAvailableCoursesForInvoicing, getNextInvoiceNumber, updateCourse } from '../utils/storage';
import { FileText, Plus, X } from 'lucide-react';
import { getCurrentDateForInput } from '../utils/dateUtils';

interface InvoiceFromCoursesProps {
  onGenerateInvoice: (items: Item[], clientData: Client, courseIds: string[], invoiceNumber: string) => void;
  onClose: () => void;
}

const InvoiceFromCourses: React.FC<InvoiceFromCoursesProps> = ({ onGenerateInvoice, onClose }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      const [loadedCourses, loadedClients, nextInvoiceNumber] = await Promise.all([
        loadCourses(),
        loadClients(),
        getNextInvoiceNumber()
      ]);
      setCourses(loadedCourses);
      setClients(loadedClients);
      setInvoiceNumber(nextInvoiceNumber);
    };
    
    loadData();
  }, []);

  const getClientName = (clientId: string): string => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Cliente no encontrado';
  };

  const getSelectedClient = (): Client | null => {
    return clients.find(c => c.id === selectedClientId) || null;
  };

  const handleCourseToggle = (courseId: string) => {
    setSelectedCourses(prev => 
      prev.includes(courseId) 
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleClientChange = async (clientId: string) => {
    setSelectedClientId(clientId);
    // Limpiar selección de cursos
    setSelectedCourses([]);
    
    // Cargar cursos disponibles para este cliente
    if (clientId) {
      const availableCourses = await getAvailableCoursesForInvoicing(clientId);
      setCourses(availableCourses);
    }
  };

  const getFilteredCourses = (): Course[] => {
    if (!selectedClientId) return [];
    return courses.filter(course => 
      course.clientId === selectedClientId && 
      course.status === 'dictado' // Solo cursos dictados pero no facturados
    );
  };

  const handleGenerateInvoice = async () => {
    const selectedClient = getSelectedClient();
    if (!selectedClient || selectedCourses.length === 0) {
      alert('Por favor selecciona un cliente y al menos un curso');
      return;
    }

    const selectedCourseObjects = courses.filter(course => 
      selectedCourses.includes(course.id)
    );

    // Actualizar cursos a estado "facturada" y asignar número de factura
    for (const course of selectedCourseObjects) {
      await updateCourse(course.id, {
        ...course,
        status: 'facturado',
        invoiceNumber: invoiceNumber,
        invoiceDate: new Date().toISOString().split('T')[0]
      });
    }

    const items: Item[] = selectedCourseObjects.map(course => ({
      description: `${course.courseName} (${course.startDate} - ${course.endDate})`,
      quantity: course.hours,
      unitPrice: course.hourlyRate
    }));

    onGenerateInvoice(items, selectedClient, selectedCourses, invoiceNumber);
  };

  const getTotalAmount = (): number => {
    return courses
      .filter(course => selectedCourses.includes(course.id))
      .reduce((total, course) => total + course.totalValue, 0);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <FileText className="mr-2" size={20} />
            Generar Factura desde Cursos
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            title="Cerrar"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {/* Información de la Factura */}
          <div className="mb-6 bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Información de la Factura</h4>
            <div className="text-sm text-blue-800">
              <p><strong>Número de Factura:</strong> {invoiceNumber}</p>
              <p><strong>Fecha:</strong> {getCurrentDateForInput()}</p>
            </div>
          </div>

          {/* Selección de Cliente */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar Cliente *
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => handleClientChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Seleccionar cliente para generar factura"
            >
              <option value="">Seleccionar cliente</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>

          {/* Lista de Cursos */}
          {selectedClientId && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Cursos de {getClientName(selectedClientId)}
              </h3>
              
              {getFilteredCourses().length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No hay cursos registrados para este cliente
                </p>
              ) : (
                <div className="space-y-3">
                  {getFilteredCourses().map(course => (
                    <div 
                      key={course.id} 
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                    >
                      <label className="flex items-start space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCourses.includes(course.id)}
                          onChange={() => handleCourseToggle(course.id)}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-gray-900">{course.courseName}</h4>
                              <p className="text-sm text-gray-600">
                                {course.startDate} - {course.endDate}
                              </p>
                              <p className="text-sm text-gray-600">
                                {course.hours} horas × ${course.hourlyRate.toLocaleString()}/hora
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-gray-900">
                                ${course.totalValue.toLocaleString()}
                              </p>
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                course.status === 'pagado' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {course.status === 'pagado' ? 'Pagado' : 'Pendiente'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Resumen */}
          {selectedCourses.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-2">Resumen de la Factura</h4>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">
                  {selectedCourses.length} curso(s) seleccionado(s)
                </span>
                <span className="text-xl font-bold text-gray-900">
                  Total: ${getTotalAmount().toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end space-x-4">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
            <button
              onClick={handleGenerateInvoice}
              disabled={!selectedClientId || selectedCourses.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="mr-2" size={16} />
              Generar Factura
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceFromCourses; 