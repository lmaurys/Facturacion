import React, { useState, useEffect } from 'react';
import { Database } from 'lucide-react';

interface DataManagementProps {
  onDataImported?: () => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ onDataImported }) => {
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [systemStatus, setSystemStatus] = useState<'loading' | 'active' | 'error'>('loading');

  useEffect(() => {
    // Mostrar cuándo se cargó la página del sistema
    const currentTime = new Date().toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    setLastUpdate(currentTime);
    setSystemStatus('active');

    // Actualizar la fecha cada vez que se modifique algo
    const handleDataUpdate = () => {
      const updateTime = new Date().toLocaleString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      setLastUpdate(updateTime);
      setSystemStatus('active');
    };

    // Escuchar eventos de actualización
    window.addEventListener('courseUpdated', handleDataUpdate);
    window.addEventListener('clientUpdated', handleDataUpdate);
    window.addEventListener('invoiceUpdated', handleDataUpdate);
    window.addEventListener('azureSyncSuccess', handleDataUpdate);

    return () => {
      window.removeEventListener('courseUpdated', handleDataUpdate);
      window.removeEventListener('clientUpdated', handleDataUpdate);
      window.removeEventListener('invoiceUpdated', handleDataUpdate);
      window.removeEventListener('azureSyncSuccess', handleDataUpdate);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="flex items-center">
            <Database className="mr-3 text-blue-600" size={24} />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Gestión Central de Datos</h2>
              <p className="text-sm text-gray-600">Sistema de gestión y sincronización de datos</p>
            </div>
          </div>
        </div>

        {/* Información de última actualización */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado del Sistema</h3>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-600 font-medium">Sistema accedido:</span>
              <span className="text-gray-900 font-semibold">
                {lastUpdate}
              </span>
            </div>
            
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-600 font-medium">Estado:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                systemStatus === 'active' ? 'bg-green-100 text-green-800' : 
                systemStatus === 'error' ? 'bg-red-100 text-red-800' : 
                'bg-yellow-100 text-yellow-800'
              }`}>
                {systemStatus === 'active' ? 'Activo' : 
                 systemStatus === 'error' ? 'Error' : 'Cargando'}
              </span>
            </div>
            
            <p className="text-xs text-gray-500 mt-2">
              Los datos se actualizan automáticamente al guardar o editar cualquier registro
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataManagement; 