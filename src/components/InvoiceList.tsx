import React, { useState, useEffect } from 'react';
import { InvoiceFromCourse, Client, Course } from '../types';
import { loadClients, loadCourses, updateInvoice } from '../utils/storage';
import { 
  Eye, 
  Edit2, 
  Trash2, 
  Plus, 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Send,
  DollarSign,
  FileText,
  Calendar,
  Filter
} from 'lucide-react';
import { formatDate } from '../utils/dateUtils';

interface InvoiceListProps {
  invoices: InvoiceFromCourse[];
  onEdit: (invoice: InvoiceFromCourse) => void;
  onDelete: (id: string) => void;
  onView: (invoice: InvoiceFromCourse) => void;
  onAdd: () => void;
}

type SortKey = 'invoiceNumber' | 'clientId' | 'invoiceDate' | 'total' | 'status';
type SortDirection = 'asc' | 'desc' | null;

const InvoiceList: React.FC<InvoiceListProps> = ({ 
  invoices, 
  onEdit, 
  onDelete, 
  onView, 
  onAdd 
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

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

  const getClientName = (clientId: string): string => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Cliente no encontrado';
  };

  const getCourseNames = (courseIds: string[]): string[] => {
    return courseIds.map(courseId => {
      const course = courses.find(c => c.id === courseId);
      return course ? course.courseName : 'Curso no encontrado';
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadge = (status: 'draft' | 'sent' | 'paid') => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap";
    if (status === 'paid') {
      return `${baseClasses} bg-green-100 text-green-800`;
    } else if (status === 'sent') {
      return `${baseClasses} bg-blue-100 text-blue-800`;
    }
    return `${baseClasses} bg-gray-100 text-gray-800`;
  };

  const getStatusText = (status: 'draft' | 'sent' | 'paid') => {
    if (status === 'paid') return 'Pagada';
    if (status === 'sent') return 'Enviada';
    return 'Borrador';
  };

  const handleQuickStatusChange = async (invoice: InvoiceFromCourse, newStatus: 'draft' | 'sent' | 'paid') => {
    try {
      const updatedInvoice = await updateInvoice(invoice.id, {
        ...invoice,
        status: newStatus
      });

      if (updatedInvoice) {
        // Recargar la página para refrescar los datos
        window.location.reload();
      } else {
        alert('Error al actualizar el estado de la factura');
      }
    } catch (error) {
      console.error('Error updating invoice status:', error);
      alert('Error al actualizar el estado de la factura');
    }
  };

  const getQuickActionButtons = (invoice: InvoiceFromCourse) => {
    const buttons = [];
    
    if (invoice.status === 'draft') {
      buttons.push(
        <button
          key="send"
          onClick={() => handleQuickStatusChange(invoice, 'sent')}
          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
          title="Marcar como enviada"
        >
          <Send size={14} />
        </button>
      );
    }
    
    if (invoice.status === 'draft' || invoice.status === 'sent') {
      buttons.push(
        <button
          key="paid"
          onClick={() => handleQuickStatusChange(invoice, 'paid')}
          className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
          title="Marcar como pagada"
        >
          <DollarSign size={14} />
        </button>
      );
    }
    
    return buttons;
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      // Cambiar dirección o resetear
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown size={14} className="text-gray-400" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp size={14} className="text-blue-600" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown size={14} className="text-blue-600" />;
    }
    return <ArrowUpDown size={14} className="text-gray-400" />;
  };

  const filteredAndSortedInvoices = React.useMemo(() => {
    let filtered = invoices.filter(invoice => {
      const courseNames = getCourseNames(invoice.courseIds);
      const matchesSearch = 
        invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getClientName(invoice.clientId).toLowerCase().includes(searchTerm.toLowerCase()) ||
        courseNames.some(name => name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (invoice.observations && invoice.observations.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
      const matchesClient = clientFilter === 'all' || invoice.clientId === clientFilter;
      
      return matchesSearch && matchesStatus && matchesClient;
    });

    if (sortKey && sortDirection) {
      filtered.sort((a, b) => {
        let aValue: any = a[sortKey];
        let bValue: any = b[sortKey];

        // Casos especiales para ordenamiento
        if (sortKey === 'clientId') {
          aValue = getClientName(a.clientId);
          bValue = getClientName(b.clientId);
        } else if (sortKey === 'invoiceDate') {
          aValue = new Date(a.invoiceDate).getTime();
          bValue = new Date(b.invoiceDate).getTime();
        }

        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [invoices, searchTerm, statusFilter, clientFilter, sortKey, sortDirection, clients, courses]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setClientFilter('all');
    setSortKey(null);
    setSortDirection(null);
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Lista de Facturas</h2>
        <button
          onClick={onAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center"
        >
          <Plus className="mr-2" size={20} />
          Nueva Factura
        </button>
      </div>

      {/* Información sobre acciones rápidas */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Acciones Rápidas:</h4>
        <div className="text-sm text-blue-800 grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="flex items-center">
            <Send size={14} className="mr-2" />
            <span>Marcar como enviada</span>
          </div>
          <div className="flex items-center">
            <DollarSign size={14} className="mr-2" />
            <span>Marcar como pagada</span>
          </div>
          <div className="flex items-center">
            <Edit2 size={14} className="mr-2" />
            <span>Editar factura completa</span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar factura, cliente, curso..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filtro por Estado */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Filtrar por estado"
            >
              <option value="all">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="sent">Enviada</option>
              <option value="paid">Pagada</option>
            </select>
          </div>

          {/* Filtro por Cliente */}
          <div>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Filtrar por cliente"
            >
              <option value="all">Todos los clientes</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>

          {/* Limpiar Filtros */}
          <div className="flex items-center">
            <button
              onClick={clearFilters}
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
              title="Limpiar todos los filtros"
            >
              <Filter className="mr-2" size={16} />
              Limpiar
            </button>
            <span className="ml-3 text-sm text-gray-500">
              {filteredAndSortedInvoices.length} de {invoices.length}
            </span>
          </div>
        </div>
      </div>

      {filteredAndSortedInvoices.length === 0 ? (
        <div className="text-center py-12">
          <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {invoices.length === 0 ? 'No hay facturas registradas' : 'No se encontraron facturas'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {invoices.length === 0 
              ? 'Las facturas aparecerán aquí cuando crees cursos.' 
              : 'Intenta ajustar los filtros de búsqueda.'}
          </p>
          {invoices.length === 0 && (
            <div className="mt-6">
              <button
                onClick={onAdd}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="mr-2" size={16} />
                Nueva Factura
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-1/8"
                  onClick={() => handleSort('invoiceNumber')}
                >
                  <div className="flex items-center justify-between">
                    <span>Número</span>
                    {getSortIcon('invoiceNumber')}
                  </div>
                </th>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-1/6"
                  onClick={() => handleSort('clientId')}
                >
                  <div className="flex items-center justify-between">
                    <span>Cliente</span>
                    {getSortIcon('clientId')}
                  </div>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                  Cursos
                </th>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-1/8"
                  onClick={() => handleSort('invoiceDate')}
                >
                  <div className="flex items-center justify-between">
                    <span>Fecha</span>
                    {getSortIcon('invoiceDate')}
                  </div>
                </th>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-1/8"
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center justify-between">
                    <span>Total</span>
                    {getSortIcon('total')}
                  </div>
                </th>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-1/8"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center justify-between">
                    <span>Estado</span>
                    {getSortIcon('status')}
                  </div>
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedInvoices.map((invoice) => {
                const courseNames = getCourseNames(invoice.courseIds);
                return (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-3 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {invoice.invoiceNumber}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-sm text-gray-900 leading-5 break-words">
                        {getClientName(invoice.clientId)}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-sm text-gray-900 leading-5">
                        {courseNames.slice(0, 2).map((name, index) => (
                          <div key={index} className="mb-1">
                            • {name}
                          </div>
                        ))}
                        {courseNames.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{courseNames.length - 2} más...
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-sm text-gray-900 flex items-center">
                        <Calendar className="mr-1" size={14} />
                        <div>{formatDate(invoice.invoiceDate)}</div>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-sm font-medium text-gray-900 flex items-center">
                        <DollarSign className="mr-1" size={14} />
                        <div>
                          <div className="font-bold">{formatCurrency(invoice.total)}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Subtotal: {formatCurrency(invoice.subtotal)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-col space-y-2">
                        <span className={getStatusBadge(invoice.status)}>
                          {getStatusText(invoice.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <div className="flex justify-end space-x-1">
                        {/* Botones de acción rápida para cambio de estado */}
                        {getQuickActionButtons(invoice)}
                        
                        {/* Separador visual si hay botones de estado */}
                        {getQuickActionButtons(invoice).length > 0 && (
                          <div className="w-px h-6 bg-gray-300 mx-1"></div>
                        )}
                        
                        {/* Botones de acción estándar */}
                        <button
                          onClick={() => onView(invoice)}
                          className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                          title="Ver factura"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => onEdit(invoice)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                          title="Editar factura"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(invoice.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                          title="Eliminar factura"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InvoiceList; 