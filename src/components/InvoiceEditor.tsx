import React, { useState, useEffect, useRef } from 'react';
import { InvoiceFromCourse, Client, Course, Issuer, Language, TransferOption } from '../types';
import { loadClients, loadCourses, updateInvoice, validateInvoiceUpdate, diagnoseInvoiceIssues } from '../utils/storage';
import { Edit2, X, Save, AlertCircle, ArrowUp } from 'lucide-react';
import { transferOptions, invoiceLabels } from '../constants/invoiceConstants';

interface InvoiceEditorProps {
  invoice: InvoiceFromCourse;
  onSave: () => void;
  onCancel: () => void;
}

const InvoiceEditor: React.FC<InvoiceEditorProps> = ({ invoice, onSave, onCancel }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [formData, setFormData] = useState({
    clientId: invoice.clientId,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    issuer: invoice.issuer,
    language: invoice.language,
    paymentTerms: invoice.paymentTerms,
    status: invoice.status,
    transferOption: invoice.transferOption || 'usa',
    observations: invoice.observations || ''
  });

  useEffect(() => {
    const loadData = async () => {
      const [loadedClients, loadedCourses] = await Promise.all([
        loadClients(),
        loadCourses()
      ]);
      setClients(loadedClients);
      setCourses(loadedCourses);
    };
    
    loadData();
  }, []);

  // Mostrar FAB para subir dentro del modal cuando el contenido hace scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 300);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true } as any);
    return () => el.removeEventListener('scroll', onScroll as any);
  }, []);

  const relatedCourses = courses.filter(course => 
    invoice.courseIds.includes(course.id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const invoiceDataToUpdate = {
        clientId: formData.clientId,
        courseIds: invoice.courseIds,
        invoiceNumber: formData.invoiceNumber,
        invoiceDate: formData.invoiceDate,
        issuer: formData.issuer,
        language: formData.language,
        paymentTerms: formData.paymentTerms,
        subtotal: invoice.subtotal,
        total: invoice.total,
        status: formData.status,
        transferOption: formData.transferOption,
        observations: formData.observations
      };

      console.log('🔄 Actualizando factura con datos:', invoiceDataToUpdate);
      console.log('🔍 Verificando emisor antes de actualizar:', {
        original: invoice.issuer,
        nuevo: formData.issuer
      });
      
      const updatedInvoice = await updateInvoice(invoice.id, invoiceDataToUpdate);

      if (updatedInvoice) {
        console.log('✅ Factura actualizada exitosamente:', updatedInvoice);
        console.log('🔍 Verificando emisor después de actualizar:', {
          emisorEnRespuesta: updatedInvoice.issuer,
          emisorEnFormulario: formData.issuer
        });
        
        // Validar que todos los campos se guardaron correctamente
        const isValid = await validateInvoiceUpdate(invoice.id, {
          issuer: formData.issuer,
          language: formData.language,
          status: formData.status,
          invoiceNumber: formData.invoiceNumber
        });
        
        if (isValid) {
          alert('✅ Factura actualizada exitosamente. Todos los campos se guardaron correctamente.');
        } else {
          console.warn('⚠️ Algunos campos no se actualizaron correctamente');
          alert('⚠️ La factura se actualizó pero algunos campos podrían no haberse guardado correctamente. Revisa la consola para más detalles.');
          
          // Ejecutar diagnóstico específico si hay problemas
          await diagnoseInvoiceIssues(invoice.id);
        }
        
        onSave();
      } else {
        console.log('❌ updateInvoice retornó null');
        alert('❌ Error al actualizar la factura. Intenta nuevamente.');
      }
    } catch (error) {
      console.error('❌ Error actualizando factura:', error);
      alert('❌ Error al actualizar la factura. Revisa la consola para más detalles.');
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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

  const t = invoiceLabels[formData.language];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div ref={scrollRef} className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Edit2 className="mr-2" size={20} />
            Editar Factura {invoice.invoiceNumber}
          </h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => diagnoseInvoiceIssues(invoice.id)}
              className="text-gray-500 hover:text-gray-700 flex items-center"
              title="Diagnosticar problemas con esta factura (revisa la consola)"
            >
              <AlertCircle size={20} />
            </button>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
              title="Cerrar"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Número de Factura */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de Factura *
              </label>
              <input
                type="text"
                value={formData.invoiceNumber}
                onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Número único de la factura"
                required
              />
            </div>

            {/* Fecha de Factura */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Factura *
              </label>
              <input
                type="date"
                value={formData.invoiceDate}
                onChange={(e) => handleInputChange('invoiceDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Fecha de emisión de la factura"
                required
              />
            </div>

            {/* Cliente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cliente *
              </label>
              <select
                value={formData.clientId}
                onChange={(e) => handleInputChange('clientId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Seleccionar cliente para la factura"
                required
              >
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>

            {/* Emisor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Emisor *
              </label>
              <select
                value={formData.issuer}
                onChange={(e) => handleInputChange('issuer', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Seleccionar emisor de la factura"
                required
              >
                <option value="colombia">Colombia</option>
                <option value="usa">USA</option>
              </select>
            </div>

            {/* Idioma */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Idioma *
              </label>
              <select
                value={formData.language}
                onChange={(e) => handleInputChange('language', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Seleccionar idioma de la factura"
                required
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* Términos de Pago */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Términos de Pago (días) *
              </label>
              <input
                type="number"
                value={formData.paymentTerms}
                onChange={(e) => handleInputChange('paymentTerms', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Días para el vencimiento de la factura"
                min="1"
                required
              />
            </div>

            {/* Opción de Transferencia */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.transferOption} *
              </label>
              <select
                value={formData.transferOption}
                onChange={(e) => handleInputChange('transferOption', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Seleccionar opción de transferencia"
                required
              >
                <option value="usa">{transferOptions.usa.name}</option>
                <option value="panama">{transferOptions.panama.name}</option>
                <option value="colombia">{transferOptions.colombia.name}</option>
              </select>
            </div>

            {/* Estado de la Factura */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado de la Factura *
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Estado actual de la factura"
                required
              >
                <option value="draft">Borrador</option>
                <option value="sent">Enviada</option>
                <option value="paid">Pagada</option>
              </select>
            </div>
          </div>

          {/* Observaciones */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observaciones
            </label>
            <textarea
              value={formData.observations}
              onChange={(e) => handleInputChange('observations', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Observaciones adicionales sobre la factura..."
            />
          </div>

          {/* Cursos Incluidos */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Cursos Incluidos en la Factura
            </h3>
            
            {relatedCourses.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No se encontraron cursos relacionados
              </p>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-3">
                  {relatedCourses.map(course => (
                    <div key={course.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900">{course.courseName}</h4>
                          <p className="text-sm text-gray-600">
                            {course.startDate} - {course.endDate}
                          </p>
                          <p className="text-sm text-gray-600">
                            {course.hours} horas × {formatCurrency(course.hourlyRate)}/hora
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(course.totalValue)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium text-gray-900">
                      Total de la Factura:
                    </span>
                    <span className="text-xl font-bold text-gray-900">
                      {formatCurrency(invoice.total)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex justify-end space-x-4">
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
              Guardar Cambios
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

export default InvoiceEditor; 