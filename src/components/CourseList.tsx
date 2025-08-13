import React, { useState, useEffect } from 'react';
import { Course, Client } from '../types';
import { Edit2, Trash2, Plus, Calendar, DollarSign, Clock, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { loadClients } from '../utils/storage';
import { formatDate } from '../utils/dateUtils';
import { formatHours, formatHourlyRate, formatCurrency } from '../utils/numberUtils';

interface CourseListProps {
  courses: Course[];
  onEdit: (course: Course) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

type SortKey = 'courseName' | 'clientId' | 'startDate' | 'hours' | 'totalValue' | 'status' | 'invoiceNumber';
type SortDirection = 'asc' | 'desc' | null;

const CourseList: React.FC<CourseListProps> = ({ courses, onEdit, onDelete, onAdd }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

  useEffect(() => {
    // Cargar clientes para mostrar los nombres
    const loadClientsAsync = async () => {
      const loadedClients = await loadClients();
      setClients(loadedClients);
    };
    
    loadClientsAsync();
  }, []);

  const getClientName = (clientId: string): string => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Cliente no encontrado';
  };

  const getStatusBadge = (status: 'creado' | 'dictado' | 'facturado' | 'pagado') => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap";
    if (status === 'pagado') {
      return `${baseClasses} bg-green-100 text-green-800`;
    } else if (status === 'facturado') {
      return `${baseClasses} bg-blue-100 text-blue-800`;
    } else if (status === 'dictado') {
      return `${baseClasses} bg-orange-100 text-orange-800`;
    }
    return `${baseClasses} bg-gray-100 text-gray-800`;
  };

  const getStatusText = (status: 'creado' | 'dictado' | 'facturado' | 'pagado') => {
    if (status === 'pagado') return 'Pagado';
    if (status === 'facturado') return 'Facturado';
    if (status === 'dictado') return 'Dictado';
    return 'Creado';
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

  const filteredAndSortedCourses = React.useMemo(() => {
    let filtered = courses.filter(course => {
      const matchesSearch = 
        course.courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getClientName(course.clientId).toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.observations.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || course.status === statusFilter;
      const matchesClient = clientFilter === 'all' || course.clientId === clientFilter;
      
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
        } else if (sortKey === 'startDate') {
          aValue = new Date(a.startDate).getTime();
          bValue = new Date(b.startDate).getTime();
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
  }, [courses, searchTerm, statusFilter, clientFilter, sortKey, sortDirection, clients]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setClientFilter('all');
    setSortKey(null);
    setSortDirection(null);
  };

  const handleDeleteCourse = (course: Course) => {
    const isInvoiced = course.status === 'facturado' || course.status === 'pagado';
    
    if (isInvoiced) {
      // Confirmación especial para cursos facturados
      const confirmMessage = `⚠️ ATENCIÓN: Eliminar Curso Facturado

Curso: ${course.courseName}
Cliente: ${getClientName(course.clientId)}
Estado: ${getStatusText(course.status)}
${course.invoiceNumber ? `Número de Factura: ${course.invoiceNumber}` : ''}
Valor: ${formatCurrency(course.totalValue)}

🚨 ADVERTENCIA: Este curso ya ha sido facturado${course.status === 'pagado' ? ' y pagado' : ''}. 
Al eliminarlo podrías:
• Perder el historial de facturación
• Crear inconsistencias en los registros
• Afectar reportes financieros

¿Estás COMPLETAMENTE SEGURO de que quieres eliminar este curso?

Escribe "CONFIRMAR" para proceder:`;
      
      const userInput = prompt(confirmMessage);
      if (userInput === 'CONFIRMAR') {
        onDelete(course.id);
      }
    } else {
      // Confirmación normal para cursos no facturados
      if (window.confirm(`¿Estás seguro de que quieres eliminar el curso "${course.courseName}"?`)) {
        onDelete(course.id);
      }
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Registro de Cursos</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFiltersOpen(prev => !prev)}
            className="md:hidden border px-3 py-2 rounded text-gray-700 hover:bg-gray-50 flex items-center"
            title="Mostrar/ocultar filtros"
          >
            <Filter className="mr-2" size={16} /> Filtros
          </button>
          <button
            onClick={onAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center"
          >
            <Plus className="mr-2" size={20} />
            Nuevo Curso
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className={`mb-4 md:mb-6 p-4 bg-gray-50 rounded-lg ${filtersOpen ? 'block' : 'hidden'} md:block`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar curso, cliente, factura..."
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
              <option value="creado">Creado</option>
              <option value="dictado">Dictado</option>
              <option value="facturado">Facturado</option>
              <option value="pagado">Pagado</option>
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
              {filteredAndSortedCourses.length} de {courses.length}
            </span>
          </div>
        </div>
      </div>

      {filteredAndSortedCourses.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {courses.length === 0 ? 'No hay cursos registrados' : 'No se encontraron cursos'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {courses.length === 0 
              ? 'Comienza creando tu primer curso.' 
              : 'Intenta ajustar los filtros de búsqueda.'}
          </p>
          {courses.length === 0 && (
            <div className="mt-6">
              <button
                onClick={onAdd}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="mr-2" size={16} />
                Nuevo Curso
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Vista móvil en tarjetas */}
          <div className="block md:hidden space-y-3">
            {filteredAndSortedCourses.map((course) => (
              <div key={course.id} className="border rounded-lg p-3 bg-white">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{course.courseName}</div>
                    <div className="text-xs text-gray-600 mt-1">{getClientName(course.clientId)}</div>
                    <div className="text-xs text-gray-600">{formatDate(course.startDate)} → {formatDate(course.endDate)}</div>
                    {course.observations && (
                      <div className="text-[11px] text-gray-500 mt-1">{course.observations}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{formatCurrency(course.totalValue)}</div>
                    <span className={`${getStatusBadge(course.status)}`}>{getStatusText(course.status)}</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => onEdit(course)}
                    className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                    title="Editar curso"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteCourse(course)}
                    className={`p-1 rounded ${
                      course.status === 'facturado' || course.status === 'pagado'
                        ? 'text-orange-600 hover:text-orange-900 hover:bg-orange-50'
                        : 'text-red-600 hover:text-red-900 hover:bg-red-50'
                    }`}
                    title={
                      course.status === 'facturado' || course.status === 'pagado'
                        ? 'Eliminar curso facturado (requiere confirmación especial)'
                        : 'Eliminar curso'
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Tabla en escritorio */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-1/4"
                  onClick={() => handleSort('courseName')}
                >
                  <div className="flex items-center justify-between">
                    <span>Curso</span>
                    {getSortIcon('courseName')}
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
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-1/8"
                  onClick={() => handleSort('startDate')}
                >
                  <div className="flex items-center justify-between">
                    <span>Fechas</span>
                    {getSortIcon('startDate')}
                  </div>
                </th>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-1/8"
                  onClick={() => handleSort('hours')}
                >
                  <div className="flex items-center justify-between">
                    <span>Horas</span>
                    {getSortIcon('hours')}
                  </div>
                </th>
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-1/8"
                  onClick={() => handleSort('totalValue')}
                >
                  <div className="flex items-center justify-between">
                    <span>Valor</span>
                    {getSortIcon('totalValue')}
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
                <th 
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-1/8"
                  onClick={() => handleSort('invoiceNumber')}
                >
                  <div className="flex items-center justify-between">
                    <span>Factura</span>
                    {getSortIcon('invoiceNumber')}
                  </div>
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">
                  Acciones
                </th>
              </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedCourses.map((course) => (
                <tr key={course.id} className="hover:bg-gray-50">
                  <td className="px-3 py-4">
                    <div className="text-sm font-medium text-gray-900 leading-5">
                      {course.courseName}
                    </div>
                    {course.observations && (
                      <div className="text-xs text-gray-500 mt-1 leading-4 max-w-xs">
                        {course.observations}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <div className="text-sm text-gray-900 leading-5 break-words">
                      {getClientName(course.clientId)}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="text-xs text-gray-900 leading-4">
                      <div className="flex items-center mb-1">
                        <Calendar className="mr-1" size={12} />
                        <span className="font-medium">Inicio:</span>
                      </div>
                      <div className="mb-2">{formatDate(course.startDate)}</div>
                      <div className="flex items-center mb-1">
                        <Calendar className="mr-1" size={12} />
                        <span className="font-medium">Fin:</span>
                      </div>
                      <div>{formatDate(course.endDate)}</div>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="text-sm text-gray-900 flex items-center mb-2">
                      <Clock className="mr-1" size={14} />
                      <span className="font-medium">{formatHours(course.hours)}h</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      ${formatHourlyRate(course.hourlyRate)}/h
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="text-sm font-medium text-gray-900 flex items-center mb-1">
                      <DollarSign className="mr-1" size={14} />
                      <div>
                        <div className="font-bold">{formatCurrency(course.totalValue)}</div>
                        {course.status === 'pagado' && course.paidAmount > 0 && (
                          <div className="text-xs text-green-600 mt-1">
                            Pagado: {formatCurrency(course.paidAmount)}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-col space-y-2">
                      <span className={getStatusBadge(course.status)}>
                        {getStatusText(course.status)}
                      </span>
                      {course.status === 'pagado' && course.paymentDate && (
                        <div className="text-xs text-gray-500">
                          {formatDate(course.paymentDate)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="text-sm text-gray-900">
                      {course.invoiceNumber || '-'}
                    </div>
                    {course.invoiceDate && (
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(course.invoiceDate)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-4 text-right">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <button
                        onClick={() => onEdit(course)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="Editar curso"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(course)}
                        className={`p-1 rounded ${
                          course.status === 'facturado' || course.status === 'pagado'
                            ? 'text-orange-600 hover:text-orange-900 hover:bg-orange-50'
                            : 'text-red-600 hover:text-red-900 hover:bg-red-50'
                        }`}
                        title={
                          course.status === 'facturado' || course.status === 'pagado'
                            ? 'Eliminar curso facturado (requiere confirmación especial)'
                            : 'Eliminar curso'
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default CourseList; 