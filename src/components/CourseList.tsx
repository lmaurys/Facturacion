import React, { useRef } from 'react';
import { Course } from '../types';
import { Edit2, Trash2, Plus, Calendar, DollarSign, Clock, Download, Upload } from 'lucide-react';
import { exportCourses, importCourses } from '../utils/storage';

interface CourseListProps {
  courses: Course[];
  onEdit: (course: Course) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onRefresh?: () => void;
}

const CourseList: React.FC<CourseListProps> = ({ courses, onEdit, onDelete, onAdd, onRefresh }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadge = (status: 'enviada' | 'pagada') => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    if (status === 'pagada') {
      return `${baseClasses} bg-green-100 text-green-800`;
    }
    return `${baseClasses} bg-yellow-100 text-yellow-800`;
  };

  const getStatusText = (status: 'enviada' | 'pagada') => {
    return status === 'pagada' ? 'Pagada' : 'Enviada';
  };

  const handleExportCourses = async () => {
    try {
      const jsonData = await exportCourses();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cursos_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting courses:', error);
      alert('Error al exportar los cursos');
    }
  };

  const handleImportCourses = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const success = await importCourses(text);
      
      if (success) {
        alert('Cursos importados exitosamente');
        onRefresh && onRefresh();
      } else {
        alert('Error al importar los cursos. Verifica que el archivo sea válido.');
      }
    } catch (error) {
      console.error('Error importing courses:', error);
      alert('Error al leer el archivo');
    }
    
    // Limpiar el input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Registro de Cursos</h2>
        <div className="flex space-x-2">
          <button
            onClick={handleExportCourses}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded flex items-center"
            title="Exportar cursos a JSON"
          >
            <Download className="mr-2" size={16} />
            Exportar
          </button>
          <button
            onClick={handleImportCourses}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded flex items-center"
            title="Importar cursos desde JSON"
          >
            <Upload className="mr-2" size={16} />
            Importar
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

      {/* Input oculto para importar archivos */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {courses.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay cursos registrados</h3>
          <p className="mt-1 text-sm text-gray-500">Comienza creando tu primer curso.</p>
          <div className="mt-6">
            <button
              onClick={onAdd}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2" size={16} />
              Nuevo Curso
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Curso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fechas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Horas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Factura
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {courses.map((course) => (
                <tr key={course.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {course.courseName}
                    </div>
                    {course.observations && (
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {course.observations}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{course.client}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div className="flex items-center">
                        <Calendar className="mr-1" size={14} />
                        {formatDate(course.startDate)} - {formatDate(course.endDate)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center">
                      <Clock className="mr-1" size={14} />
                      {course.hours}h
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatCurrency(course.hourlyRate)}/h
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 flex items-center">
                      <DollarSign className="mr-1" size={14} />
                      {formatCurrency(course.totalValue)}
                    </div>
                    {course.status === 'pagada' && course.paidAmount > 0 && (
                      <div className="text-sm text-green-600">
                        Pagado: {formatCurrency(course.paidAmount)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getStatusBadge(course.status)}>
                      {getStatusText(course.status)}
                    </span>
                    {course.status === 'pagada' && course.paymentDate && (
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(course.paymentDate)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {course.invoiceNumber || '-'}
                    </div>
                    {course.invoiceDate && (
                      <div className="text-sm text-gray-500">
                        {formatDate(course.invoiceDate)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => onEdit(course)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="Editar curso"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => onDelete(course.id)}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                        title="Eliminar curso"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CourseList; 