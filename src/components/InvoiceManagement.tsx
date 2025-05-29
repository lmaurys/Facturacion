import React, { useState, useEffect } from 'react';
import InvoiceList from './InvoiceList';
import InvoiceViewer from './InvoiceViewer';
import InvoiceEditor from './InvoiceEditor';
import InvoiceFromCourses from './InvoiceFromCourses';
import { InvoiceFromCourse, Client, Item, Course } from '../types';
import { loadInvoices, deleteInvoice, addInvoice, loadClients, loadCourses } from '../utils/storage';

const InvoiceManagement: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceFromCourse[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceFromCourse | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceFromCourse | null>(null);
  const [showCreateFromCourses, setShowCreateFromCourses] = useState(false);

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
    if (window.confirm('¿Estás seguro de que quieres eliminar esta factura?')) {
      try {
        await deleteInvoice(id);
        await loadAllData(); // Recargar la lista
      } catch (error) {
        console.error('Error deleting invoice:', error);
        alert('Error al eliminar la factura');
      }
    }
  };

  const handleAddInvoice = () => {
    setShowCreateFromCourses(true);
  };

  const handleCreateInvoiceFromCourses = async (
    items: Item[], 
    clientData: Client, 
    courseIds: string[], 
    invoiceNumber: string
  ) => {
    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    
    const invoiceData: Omit<InvoiceFromCourse, 'id'> = {
      clientId: clientData.id,
      courseIds: courseIds,
      invoiceNumber: invoiceNumber,
      invoiceDate: new Date().toISOString().split('T')[0],
      issuer: 'colombia',
      language: 'es',
      paymentTerms: 30,
      subtotal: total,
      total: total,
      status: 'draft',
      observations: `Factura generada desde cursos: ${items.map(item => item.description).join(', ')}`
    };

    try {
      await addInvoice(invoiceData);
      setShowCreateFromCourses(false);
      await loadAllData(); // Recargar la lista
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Error al crear la factura');
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
          onAdd={handleAddInvoice}
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

      {/* Modal para crear factura desde cursos */}
      {showCreateFromCourses && (
        <InvoiceFromCourses
          onGenerateInvoice={handleCreateInvoiceFromCourses}
          onClose={() => setShowCreateFromCourses(false)}
        />
      )}
    </div>
  );
};

export default InvoiceManagement; 