import React, { useState, useEffect } from 'react';
import InvoiceList from './InvoiceList';
import InvoiceViewer from './InvoiceViewer';
import InvoiceEditor from './InvoiceEditor';
import InvoiceFromCourses from './InvoiceFromCourses';
import { Plus } from 'lucide-react';
import { InvoiceFromCourse, Client, Course, Item, Currency } from '../types';
import {
  addInvoice,
  deleteInvoice,
  loadClients,
  loadCourses,
  loadInvoices,
  loadIssuerProfiles,
  loadTransferOptions,
  updateCourse,
} from '../utils/storage';

const InvoiceManagement: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceFromCourse[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceFromCourse | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceFromCourse | null>(null);
  const [showGenerateFromCourses, setShowGenerateFromCourses] = useState(false);

  useEffect(() => {
    loadAllData();
  return () => {};
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

  // Controles avanzados de sync/diagnóstico removidos del encabezado para simplificar

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
    
    // Solo permitir eliminar facturas en borrador
    if (invoice.status !== 'draft') {
      const statusText = invoice.status === 'sent' ? 'Enviada' : invoice.status === 'paid' ? 'Pagada' : invoice.status;
      alert(`No se puede eliminar una factura en estado "${statusText}". Solo se pueden eliminar facturas en estado "Borrador".`);
      return;
    }
    
    // Confirmación para facturas en borrador
    if (!window.confirm(`¿Estás seguro de que quieres eliminar la factura "${invoice.invoiceNumber}" (Borrador)?`)) {
      return;
    }
    
    try {
      // Antes de eliminar, revertir los cursos asociados a estado "dictado"
      const relatedCourses = courses.filter(course => invoice.courseIds.includes(course.id));
      
      for (const course of relatedCourses) {
        await updateCourse(course.id, {
          ...course,
          status: 'dictado'
        });
      }
      
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
    setShowGenerateFromCourses(false);
  };

  const handleSaveEdit = async () => {
    setEditingInvoice(null);
    await loadAllData(); // Recargar datos después de editar
  };

  const handleGenerateFromCourses = async (
    items: Item[],
    clientData: Client,
    courseIds: string[],
    invoiceNumber: string,
    currency: Currency,
  ) => {
    try {
      const [issuerProfiles, transferOptions] = await Promise.all([
        loadIssuerProfiles(),
        loadTransferOptions(),
      ]);

      const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const created = await addInvoice({
        clientId: clientData.id,
        courseIds,
        invoiceNumber,
        invoiceDate: new Date().toISOString().slice(0, 10),
        currency,
        issuerId: issuerProfiles[0]?.id || '',
        language: 'es',
        paymentTerms: 30,
        subtotal: total,
        total,
        status: 'draft',
        transferOptionId: transferOptions[0]?.id || '',
        observations: `Factura generada desde cursos dictados para ${clientData.name}.`,
        items: [],
      });

      if (!created) {
        throw new Error('No se pudo crear el borrador de la factura.');
      }

      await loadAllData();
      setShowGenerateFromCourses(false);
      setEditingInvoice(created);
    } catch (error) {
      console.error('Error generating invoice from courses:', error);

      const selectedCourseObjects = courses.filter((course) => courseIds.includes(course.id));
      await Promise.all(
        selectedCourseObjects.map((course) =>
          updateCourse(course.id, {
            ...course,
            status: 'dictado',
            invoiceNumber: '',
            invoiceDate: '',
          }),
        ),
      );

      await loadAllData();
      alert('No se pudo generar la factura desde cursos. Se revirtieron los cursos a "dictado".');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="rounded-2xl bg-white p-4 shadow-md sm:p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Encabezado limpio y responsive */}
      <div className="rounded-2xl bg-white p-4 shadow-md sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Gestión de Facturas</h1>
          <button
            onClick={() => setShowGenerateFromCourses(true)}
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Plus className="mr-2" size={16} />
            Desde cursos dictados
          </button>
        </div>
      </div>

      <InvoiceList
        invoices={invoices}
        onView={handleViewInvoice}
        onEdit={handleEditInvoice}
        onDelete={handleDeleteInvoice}
      />

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
          presetStatus={(editingInvoice as any)._presetStatus}
          presetPaymentDate={(editingInvoice as any)._presetPaymentDate}
          presetPaidAmount={(editingInvoice as any)._presetPaidAmount}
        />
      )}

      {showGenerateFromCourses && (
        <InvoiceFromCourses
          onGenerateInvoice={handleGenerateFromCourses}
          onClose={() => setShowGenerateFromCourses(false)}
        />
      )}
    </div>
  );
};

export default InvoiceManagement; 
