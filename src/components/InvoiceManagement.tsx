import React, { useState, useEffect } from 'react';
import InvoiceList from './InvoiceList';
import InvoiceViewer from './InvoiceViewer';
import InvoiceEditor from './InvoiceEditor';
import { InvoiceFromCourse, Client, Course } from '../types';
import { loadInvoices, deleteInvoice, loadClients, loadCourses } from '../utils/storage';

const InvoiceManagement: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceFromCourse[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceFromCourse | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceFromCourse | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [loadedInvoices, loadedClients, loadedCourses] = await Promise.all([
        loadInvoices(),
        loadClients(),
        loadCourses()
      ]);
      setInvoices(loadedInvoices);
      setClients(loadedClients);
      setCourses(loadedCourses);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = (invoice: InvoiceFromCourse) => {
    setViewingInvoice(invoice);
  };

  const handleEditInvoice = (invoice: InvoiceFromCourse) => {
    setEditingInvoice(invoice);
  };

  const handleDeleteInvoice = async (id: string) => {
    // Buscar la factura para obtener información
    const invoice = invoices.find(inv => inv.id === id);
    
    if (!invoice) {
      alert('Error: Factura no encontrada');
      return;
    }
    
    const isPaid = invoice.status === 'paid';
    
    if (isPaid) {
      // Confirmación especial para facturas pagadas
      const confirmMessage = `🚨 ATENCIÓN: Eliminar Factura Pagada

Factura: ${invoice.invoiceNumber}
Estado: Pagada
Fecha: ${invoice.invoiceDate}
Valor: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(invoice.total)}

⚠️ ADVERTENCIA CRÍTICA: Esta factura ya ha sido PAGADA.
Al eliminarla podrías:
• Perder el historial de pagos
• Crear inconsistencias contables graves
• Afectar reportes financieros y de ingresos
• Violar políticas de auditoría

🔒 Esta es una operación de ALTO RIESGO financiero.

¿Estás COMPLETAMENTE SEGURO de que quieres eliminar esta factura pagada?

Escribe "ELIMINAR FACTURA PAGADA" para proceder:`;
      
      const userInput = prompt(confirmMessage);
      if (userInput !== 'ELIMINAR FACTURA PAGADA') {
        return; // Usuario canceló o no escribió la confirmación correcta
      }
    } else {
      // Confirmación normal para facturas no pagadas
      const statusText = invoice.status === 'sent' ? 'Enviada' : 'Borrador';
      if (!window.confirm(`¿Estás seguro de que quieres eliminar la factura "${invoice.invoiceNumber}" (${statusText})?`)) {
        return;
      }
    }
    
    try {
      await deleteInvoice(id);
      await loadAllData(); // Recargar la lista
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Error al eliminar la factura');
    }
  };



  const handleCloseModals = () => {
    setViewingInvoice(null);
    setEditingInvoice(null);
  };

  const handleSaveEdit = async () => {
    setEditingInvoice(null);
    await loadAllData(); // Recargar datos después de editar
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <InvoiceList
          invoices={invoices}
          onView={handleViewInvoice}
          onEdit={handleEditInvoice}
          onDelete={handleDeleteInvoice}
        />
      </div>

      {/* Modal para ver factura */}
      {viewingInvoice && (
        <InvoiceViewer
          invoice={viewingInvoice}
          client={clients.find(c => c.id === viewingInvoice.clientId)!}
          courses={courses.filter(c => viewingInvoice.courseIds.includes(c.id))}
          onClose={handleCloseModals}
          onEdit={() => {
            setEditingInvoice(viewingInvoice);
            setViewingInvoice(null);
          }}
        />
      )}

      {/* Modal para editar factura */}
      {editingInvoice && (
        <InvoiceEditor
          invoice={editingInvoice}
          onSave={handleSaveEdit}
          onCancel={handleCloseModals}
        />
      )}


    </div>
  );
};

export default InvoiceManagement; 