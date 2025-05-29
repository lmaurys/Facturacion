import React, { useState, useRef } from 'react';
import { Download, Upload, Database, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { exportAllData, importAllData } from '../utils/storage';

interface DataManagementProps {
  onDataImported?: () => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ onDataImported }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleExportData = async () => {
    try {
      setIsLoading(true);
      const jsonData = await exportAllData();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sistema_gestion_completo_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMessage('success', 'Datos exportados exitosamente');
    } catch (error) {
      console.error('Error exporting data:', error);
      showMessage('error', 'Error al exportar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportData = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      showMessage('info', 'Importando datos...');
      
      const text = await file.text();
      const success = await importAllData(text);
      
      if (success) {
        showMessage('success', 'Datos importados exitosamente. La página se actualizará.');
        onDataImported && onDataImported();
        // Recargar la página para refrescar todos los datos
        setTimeout(() => window.location.reload(), 2000);
      } else {
        showMessage('error', 'Error al importar los datos. Verifica que el archivo sea válido.');
      }
    } catch (error) {
      console.error('Error importing data:', error);
      showMessage('error', 'Error al leer el archivo. Verifica que sea un JSON válido.');
    } finally {
      setIsLoading(false);
      // Limpiar el input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const tryAutoLoadData = async () => {
    try {
      setIsLoading(true);
      showMessage('info', 'Intentando cargar datos predeterminados...');
      
      // Intentar cargar desde una ubicación predeterminada
      // Por ejemplo, desde public/data/sistema_datos.json
      const response = await fetch('/data/sistema_datos.json');
      
      if (response.ok) {
        const jsonData = await response.text();
        const success = await importAllData(jsonData);
        
        if (success) {
          showMessage('success', 'Datos predeterminados cargados exitosamente');
          onDataImported && onDataImported();
          setTimeout(() => window.location.reload(), 2000);
        } else {
          showMessage('error', 'Error al procesar los datos predeterminados');
        }
      } else {
        showMessage('info', 'No se encontraron datos predeterminados para cargar');
      }
    } catch (error) {
      console.error('Error loading default data:', error);
      showMessage('info', 'No se pudieron cargar datos predeterminados');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <div className="flex items-center mb-6">
        <Database className="mr-3" size={24} />
        <h2 className="text-2xl font-bold text-gray-900">Gestión Central de Datos</h2>
      </div>

      {/* Mensajes */}
      {message && (
        <div className={`mb-4 p-4 rounded-md flex items-center ${
          message.type === 'success' ? 'bg-green-50 text-green-800' :
          message.type === 'error' ? 'bg-red-50 text-red-800' :
          'bg-blue-50 text-blue-800'
        }`}>
          {message.type === 'success' && <CheckCircle className="mr-2" size={16} />}
          {message.type === 'error' && <AlertCircle className="mr-2" size={16} />}
          {message.type === 'info' && <RefreshCw className="mr-2" size={16} />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Exportar Datos */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
            <Download className="mr-2" size={18} />
            Exportar Datos
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Exporta todos los datos del sistema (clientes, cursos, facturas) en un archivo JSON.
          </p>
          <button
            onClick={handleExportData}
            disabled={isLoading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded flex items-center justify-center"
          >
            {isLoading ? (
              <RefreshCw className="mr-2 animate-spin" size={16} />
            ) : (
              <Download className="mr-2" size={16} />
            )}
            Exportar Todo
          </button>
        </div>

        {/* Importar Datos */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
            <Upload className="mr-2" size={18} />
            Importar Datos
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Importa datos desde un archivo JSON previamente exportado.
          </p>
          <button
            onClick={handleImportData}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded flex items-center justify-center"
          >
            {isLoading ? (
              <RefreshCw className="mr-2 animate-spin" size={16} />
            ) : (
              <Upload className="mr-2" size={16} />
            )}
            Importar Datos
          </button>
        </div>

        {/* Cargar Datos Predeterminados */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
            <RefreshCw className="mr-2" size={18} />
            Datos Predeterminados
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Intenta cargar datos predeterminados desde la aplicación.
          </p>
          <button
            onClick={tryAutoLoadData}
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded flex items-center justify-center"
          >
            {isLoading ? (
              <RefreshCw className="mr-2 animate-spin" size={16} />
            ) : (
              <RefreshCw className="mr-2" size={16} />
            )}
            Cargar Predeterminados
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
        aria-label="Seleccionar archivo JSON para importar"
      />

      {/* Información adicional */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold text-gray-900 mb-2">Información Importante:</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Los datos exportados incluyen toda la información: clientes, cursos y facturas</li>
          <li>• Al importar, se reemplazarán todos los datos existentes</li>
          <li>• Se recomienda exportar regularmente como respaldo</li>
          <li>• Los datos predeterminados se cargan desde <code>/data/sistema_datos.json</code></li>
        </ul>
      </div>
    </div>
  );
};

export default DataManagement; 