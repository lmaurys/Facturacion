import React, { useState, useEffect, useRef } from 'react';
import { InvoiceFromCourse, Client, Course } from '../types';
import { loadClients, loadCourses, updateInvoice, validateInvoiceUpdate, diagnoseInvoiceIssues, updateCourse } from '../utils/storage';
import { Edit2, X, Save, AlertCircle, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { transferOptions, invoiceLabels } from '../constants/invoiceConstants';

interface InvoiceEditorProps {
  invoice: InvoiceFromCourse;
  onSave: () => void;
  onCancel: () => void;
  presetStatus?: 'draft' | 'sent' | 'paid';
  presetPaymentDate?: string;
  presetPaidAmount?: number;
}

interface CourseLineItem {
  type: 'course';
  id: string;
  courseName: string;
  startDate: string;
  endDate: string;
  hours: number;
  hourlyRate: number;
  totalValue: number;
}

interface AdditionalLineItem {
  type: 'item';
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
}

type InvoiceLineItem = CourseLineItem | AdditionalLineItem;

const InvoiceEditor: React.FC<InvoiceEditorProps> = ({ 
  invoice, 
  onSave, 
  onCancel,
  presetStatus,
  presetPaymentDate,
  presetPaidAmount
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceLineItem[]>([]);
  const [formData, setFormData] = useState({
    clientId: invoice.clientId,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    issuer: invoice.issuer,
    language: invoice.language,
    paymentTerms: invoice.paymentTerms,
    status: presetStatus || invoice.status,
    transferOption: invoice.transferOption || 'usa',
    observations: invoice.observations || '',
    paymentDate: presetPaymentDate || invoice.paymentDate || '',
    paidAmount: presetPaidAmount !== undefined ? presetPaidAmount : (invoice.paidAmount || invoice.total || 0)
  });

  useEffect(() => {
    const loadData = async () => {
      const [loadedClients, loadedCourses] = await Promise.all([
        loadClients(),
        loadCourses()
      ]);
      setClients(loadedClients);
      setCourses(loadedCourses);
      
      // Cargar las líneas de la factura desde los cursos relacionados
      const relatedCourses = loadedCourses.filter(course => 
        invoice.courseIds.includes(course.id)
      );
      
      const courseItems: CourseLineItem[] = relatedCourses.map(course => ({
        type: 'course',
        id: course.id,
        courseName: course.courseName,
        startDate: course.startDate,
        endDate: course.endDate,
        hours: course.hours,
        hourlyRate: course.hourlyRate,
        totalValue: course.totalValue
      }));

      // Cargar items adicionales si existen
      const additionalItems: AdditionalLineItem[] = (invoice.items || []).map((item, index) => ({
        type: 'item',
        id: `item-${index}`,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalValue: item.quantity * item.unitPrice
      }));
      
      setInvoiceItems([...courseItems, ...additionalItems]);
    };
    
    loadData();
  }, [invoice.courseIds]);

  // Mostrar FAB para subir dentro del modal cuando el contenido hace scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 300);
    onScroll();
  el.addEventListener('scroll', onScroll, { passive: true } as AddEventListenerOptions);
  return () => el.removeEventListener('scroll', onScroll as EventListener);
  }, []);

  const calculateSubtotal = () => {
    return invoiceItems.reduce((sum, item) => sum + item.totalValue, 0);
  };

  const handleAddCourseItem = () => {
    const newItem: CourseLineItem = {
      type: 'course',
      id: `new-course-${Date.now()}`,
      courseName: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      hours: 0,
      hourlyRate: 0,
      totalValue: 0
    };
    setInvoiceItems([...invoiceItems, newItem]);
  };

  const handleAddAdditionalItem = () => {
    const newItem: AdditionalLineItem = {
      type: 'item',
      id: `new-item-${Date.now()}`,
      description: '',
      quantity: 1,
      unitPrice: 0,
      totalValue: 0
    };
    setInvoiceItems([...invoiceItems, newItem]);
  };

  const handleRemoveItem = (itemId: string) => {
    if (invoiceItems.length === 1) {
      alert('Debe haber al menos una línea en la factura');
      return;
    }

    // Verificar si es un curso y si está pagado
    const item = invoiceItems.find(i => i.id === itemId);
    if (item && item.type === 'course') {
      const course = courses.find(c => c.id === item.id);
      if (course && course.status === 'pagado') {
        alert('⚠️ No se puede eliminar un curso que ya ha sido pagado. Si necesitas hacer cambios, contacta al administrador.');
        return;
      }
    }

    setInvoiceItems(invoiceItems.filter(item => item.id !== itemId));
  };

  const handleItemChange = (itemId: string, field: string, value: string | number) => {
    setInvoiceItems(invoiceItems.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value } as InvoiceLineItem;
        
        // Recalcular totalValue según el tipo de línea
        if (item.type === 'course') {
          const courseItem = updatedItem as CourseLineItem;
          if (field === 'hours' || field === 'hourlyRate') {
            courseItem.totalValue = courseItem.hours * courseItem.hourlyRate;
          }
          return courseItem;
        } else {
          const additionalItem = updatedItem as AdditionalLineItem;
          if (field === 'quantity' || field === 'unitPrice') {
            additionalItem.totalValue = additionalItem.quantity * additionalItem.unitPrice;
          }
          return additionalItem;
        }
      }
      return item;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar que haya al menos una línea
    if (invoiceItems.length === 0) {
      alert('Debe haber al menos una línea en la factura');
      return;
    }

    // Validar que todas las líneas tengan información completa
    const hasEmptyFields = invoiceItems.some(item => {
      if (item.type === 'course') {
        return !item.courseName || item.hours <= 0 || item.hourlyRate <= 0;
      } else {
        return !item.description || item.quantity <= 0 || item.unitPrice < 0;
      }
    });
    
    if (hasEmptyFields) {
      alert('Todas las líneas deben tener información completa y válida');
      return;
    }

    // Validar campos requeridos si la factura se marca como pagada
    if (formData.status === 'paid') {
      if (!formData.paymentDate) {
        alert('⚠️ ERROR: Debe especificar la fecha de pago para marcar la factura como pagada.');
        return;
      }
      if (!formData.paidAmount || formData.paidAmount <= 0) {
        alert('⚠️ ERROR: Debe especificar el valor pagado (mayor a 0) para marcar la factura como pagada.');
        return;
      }
    }
    
    try {
      const subtotal = calculateSubtotal();
      const total = subtotal;

      // Separar items por tipo
      const courseItems = invoiceItems.filter(item => item.type === 'course') as CourseLineItem[];
      const additionalItems = invoiceItems.filter(item => item.type === 'item') as AdditionalLineItem[];

      // Actualizar cursos existentes
      const updatedCourseIds: string[] = [];
      
      for (const item of courseItems) {
        if (item.id.startsWith('new-course-')) {
          alert('Por ahora no se pueden crear nuevos cursos desde aquí. Crea primero el curso en la sección de Cursos.');
          return;
        } else {
          // Actualizar curso existente
          const course = courses.find(c => c.id === item.id);
          if (course) {
            await updateCourse(item.id, {
              ...course,
              courseName: item.courseName,
              startDate: item.startDate,
              endDate: item.endDate,
              hours: item.hours,
              hourlyRate: item.hourlyRate,
              totalValue: item.totalValue
            });
            updatedCourseIds.push(item.id);
          }
        }
      }

      // Preparar items adicionales para guardar (filtrar los nuevos)
      const itemsToSave = additionalItems
        .filter(item => !item.id.startsWith('new-item-') || item.description.trim() !== '')
        .map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }));

      const invoiceDataToUpdate = {
        clientId: formData.clientId,
        courseIds: updatedCourseIds,
        invoiceNumber: formData.invoiceNumber,
        invoiceDate: formData.invoiceDate,
        issuer: formData.issuer,
        language: formData.language,
        paymentTerms: formData.paymentTerms,
        subtotal: subtotal,
        total: total,
        status: formData.status,
        transferOption: formData.transferOption,
        observations: formData.observations,
        paymentDate: formData.status === 'paid' ? formData.paymentDate : undefined,
        paidAmount: formData.status === 'paid' ? formData.paidAmount : undefined,
        items: itemsToSave.length > 0 ? itemsToSave : undefined
      };

      // Si la factura se marca como pagada, actualizar cursos asociados
      if (formData.status === 'paid' && updatedCourseIds.length > 0) {
        // Calcular el total de cursos para distribuir el pago proporcionalmente
        const coursesTotal = courseItems.reduce((sum, item) => sum + item.totalValue, 0);
        
        for (const courseId of updatedCourseIds) {
          const course = courses.find(c => c.id === courseId);
          const courseItem = courseItems.find(item => item.id === courseId);
          
          if (course && courseItem) {
            // Calcular el monto pagado proporcional para este curso
            const proportionalPayment = coursesTotal > 0 
              ? (courseItem.totalValue / coursesTotal) * formData.paidAmount 
              : 0;
            
            await updateCourse(courseId, {
              ...course,
              courseName: courseItem.courseName,
              startDate: courseItem.startDate,
              endDate: courseItem.endDate,
              hours: courseItem.hours,
              hourlyRate: courseItem.hourlyRate,
              totalValue: courseItem.totalValue,
              status: 'pagado',
              paymentDate: formData.paymentDate,
              paidAmount: proportionalPayment,
              invoiceNumber: formData.invoiceNumber,
              invoiceDate: formData.invoiceDate
            });
          }
        }
      } else if (updatedCourseIds.length > 0) {
        // Si no está pagada, actualizar el estado apropiado para los cursos
        for (const courseId of updatedCourseIds) {
          const course = courses.find(c => c.id === courseId);
          const courseItem = courseItems.find(item => item.id === courseId);
          
          if (course && courseItem) {
            // Determinar el estado del curso basado en el estado de la factura
            let courseStatus: 'creado' | 'dictado' | 'facturado' | 'pagado' = course.status;
            if (formData.status === 'sent' || formData.status === 'draft') {
              // Si la factura está enviada o en borrador, marcar como facturado si aún no lo está
              if (courseStatus === 'creado' || courseStatus === 'dictado') {
                courseStatus = 'facturado';
              }
            }
            
            await updateCourse(courseId, {
              ...course,
              courseName: courseItem.courseName,
              startDate: courseItem.startDate,
              endDate: courseItem.endDate,
              hours: courseItem.hours,
              hourlyRate: courseItem.hourlyRate,
              totalValue: courseItem.totalValue,
              status: courseStatus,
              invoiceNumber: formData.invoiceNumber,
              invoiceDate: formData.invoiceDate
            });
          }
        }
      }

      const updatedInvoice = await updateInvoice(invoice.id, invoiceDataToUpdate);

      if (updatedInvoice) {
        const isValid = await validateInvoiceUpdate(invoice.id, {
          issuer: formData.issuer,
          language: formData.language,
          status: formData.status,
          invoiceNumber: formData.invoiceNumber
        });
        if (isValid) {
          let successMessage = '✅ Factura actualizada exitosamente. Todos los campos se guardaron correctamente.';
          if (formData.status === 'paid' && updatedCourseIds.length > 0) {
            successMessage += `\n\n📚 ${updatedCourseIds.length} curso(s) actualizado(s) a estado "Pagado" con fecha ${formData.paymentDate}.`;
          }
          alert(successMessage);
        } else {
          alert('⚠️ La factura se actualizó pero algunos campos podrían no haberse guardado correctamente. Revisa la consola para más detalles.');
          await diagnoseInvoiceIssues(invoice.id);
        }
        onSave();
      } else {
        alert('❌ Error al actualizar la factura. Intenta nuevamente.');
      }
    } catch {
      alert('❌ Error al actualizar la factura. Revisa la consola para más detalles.');
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // getClientName no se usa en esta vista

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
          {formData.status === 'paid' && (
            <div className="mb-6 bg-green-50 border border-green-300 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Factura Marcada como Pagada
                  </h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>Al guardar, todos los <strong>cursos asociados</strong> serán actualizados automáticamente a estado <strong>"Pagado"</strong> con la fecha y monto proporcional.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Si la factura se marca como pagada, mostrar campos de pago */}
            {formData.status === 'paid' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha de Pago *
                  </label>
                  <input
                    type="date"
                    value={formData.paymentDate}
                    onChange={e => handleInputChange('paymentDate', e.target.value)}
                    className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                    title="Fecha en que se realizó el pago - REQUERIDO"
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valor Pagado *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={formData.paidAmount}
                    onChange={e => handleInputChange('paidAmount', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                    title="Valor pagado de la factura - REQUERIDO (debe ser mayor a 0)"
                    placeholder="Ej: 1000.00"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Este valor se distribuirá proporcionalmente entre los cursos asociados
                  </p>
                </div>
              </>
            )}
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

          {/* Líneas de Factura (Editable) */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Líneas de la Factura
              </h3>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={handleAddCourseItem}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center text-sm"
                  title="Agregar línea de curso"
                >
                  <Plus className="mr-1" size={16} />
                  Curso
                </button>
                <button
                  type="button"
                  onClick={handleAddAdditionalItem}
                  className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center text-sm"
                  title="Agregar línea adicional"
                >
                  <Plus className="mr-1" size={16} />
                  Item
                </button>
              </div>
            </div>
            
            {invoiceItems.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No hay líneas en la factura
              </p>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-4">
                  {invoiceItems.map((item, index) => (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-700">Línea {index + 1}</h4>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            item.type === 'course' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {item.type === 'course' ? 'Curso' : 'Item'}
                          </span>
                          {item.type === 'course' && courses.find(c => c.id === item.id)?.status === 'pagado' && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Pagado
                            </span>
                          )}
                        </div>
                        {invoiceItems.length > 1 && (() => {
                          const isPaidCourse = item.type === 'course' && courses.find(c => c.id === item.id)?.status === 'pagado';
                          return !isPaidCourse && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Eliminar línea"
                            >
                              <Trash2 size={18} />
                            </button>
                          );
                        })()}
                      </div>
                      
                      {item.type === 'course' ? (
                        // Línea de Curso
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nombre del Curso *
                            </label>
                            <input
                              type="text"
                              value={item.courseName}
                              onChange={(e) => handleItemChange(item.id, 'courseName', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Ej: Curso de Python Avanzado"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Fecha Inicio *
                            </label>
                            <input
                              type="date"
                              value={item.startDate}
                              onChange={(e) => handleItemChange(item.id, 'startDate', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Fecha Fin *
                            </label>
                            <input
                              type="date"
                              value={item.endDate}
                              onChange={(e) => handleItemChange(item.id, 'endDate', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Horas *
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={item.hours}
                              onChange={(e) => handleItemChange(item.id, 'hours', Number(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Tarifa por Hora *
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.hourlyRate}
                              onChange={(e) => handleItemChange(item.id, 'hourlyRate', Number(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                          
                          <div className="md:col-span-2">
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-blue-900">
                                  Subtotal: {item.hours} hrs × {formatCurrency(item.hourlyRate)}/hr
                                </span>
                                <span className="text-lg font-bold text-blue-900">
                                  {formatCurrency(item.totalValue)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Línea de Item Adicional
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Descripción *
                            </label>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                              placeholder="Ej: Material didáctico, Certificado, etc."
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Cantidad *
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(item.id, 'quantity', Number(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Precio Unitario *
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => handleItemChange(item.id, 'unitPrice', Number(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                              required
                            />
                          </div>
                          
                          <div>
                            <div className="bg-green-50 border border-green-200 rounded-md p-3 h-full flex items-center justify-between">
                              <span className="text-sm font-medium text-green-900">
                                Subtotal: {item.quantity} × {formatCurrency(item.unitPrice)}
                              </span>
                              <span className="text-lg font-bold text-green-900">
                                {formatCurrency(item.totalValue)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium text-gray-900">
                      Total de la Factura:
                    </span>
                    <span className="text-2xl font-bold text-gray-900">
                      {formatCurrency(calculateSubtotal())}
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