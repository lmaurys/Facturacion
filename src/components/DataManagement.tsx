import React, { useState, useEffect } from 'react';
import { Cloud, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface DataManagementProps {
  onDataImported?: () => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ onDataImported }) => {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    // Obtener el último timestamp de sincronización
    const lastSyncTime = localStorage.getItem('lastAzureSync');
    if (lastSyncTime) {
      setLastSync(new Date(lastSyncTime).toLocaleString());
    }

    // Escuchar eventos de sincronización
    const handleSyncStart = () => {
      setSyncStatus('syncing');
      setMessage('Sincronizando con Azure Blob Storage...');
    };

    const handleSyncSuccess = () => {
      setSyncStatus('success');
      setMessage('Sincronización exitosa con Azure');
      setLastSync(new Date().toLocaleString());
      localStorage.setItem('lastAzureSync', new Date().toISOString());
    };

    const handleSyncError = () => {
      setSyncStatus('error');
      setMessage('Error en la sincronización con Azure');
    };

    // Escuchar eventos personalizados de sincronización
    window.addEventListener('azureSyncStart', handleSyncStart);
    window.addEventListener('azureSyncSuccess', handleSyncSuccess);
    window.addEventListener('azureSyncError', handleSyncError);

    return () => {
      window.removeEventListener('azureSyncStart', handleSyncStart);
      window.removeEventListener('azureSyncSuccess', handleSyncSuccess);
      window.removeEventListener('azureSyncError', handleSyncError);
    };
  }, []);

  const getStatusColor = () => {
    switch (syncStatus) {
      case 'syncing': return 'text-blue-600';
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing': return <RefreshCw className="animate-spin" size={20} />;
      case 'success': return <CheckCircle size={20} />;
      case 'error': return <AlertCircle size={20} />;
      default: return <Cloud size={20} />;
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <div className="flex items-center mb-6">
        <Cloud className="mr-3 text-blue-600" size={24} />
        <h2 className="text-2xl font-bold text-gray-900">Sistema de Persistencia Azure</h2>
      </div>

      {/* Estado de Sincronización */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className={`mr-3 ${getStatusColor()}`}>
              {getStatusIcon()}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Estado de Sincronización</h3>
              <p className={`text-sm ${getStatusColor()}`}>{message || 'Esperando sincronización...'}</p>
            </div>
          </div>
          {syncStatus === 'success' && (
            <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              Sincronizado
            </div>
          )}
          {syncStatus === 'error' && (
            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
              Error
            </div>
          )}
        </div>
        
        {lastSync && (
          <p className="text-sm text-gray-600">
            <strong>Última sincronización:</strong> {lastSync}
          </p>
        )}
      </div>

      {/* Información del Sistema */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="text-md font-semibold text-blue-900 mb-2">🔄 Sincronización Automática</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Carga inicial:</strong> Al abrir la aplicación</li>
            <li>• <strong>Sincronización:</strong> Cada 15 minutos automáticamente</li>
            <li>• <strong>Guardar cambios:</strong> Automático al crear/editar/eliminar</li>
            <li>• <strong>Fuente única:</strong> Azure Blob Storage</li>
          </ul>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <h4 className="text-md font-semibold text-green-900 mb-2">📊 Información de Datos</h4>
          <ul className="text-sm text-green-800 space-y-1">
            <li>• <strong>Storage:</strong> Azure Blob Storage</li>
            <li>• <strong>Container:</strong> capacitaciones</li>
            <li>• <strong>Archivo:</strong>sistema_gestion_completo.json</li>
            <li>• <strong>Autenticación:</strong> SAS Token</li>
          </ul>
        </div>
      </div>

      {/* Nota Importante */}
      <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
        <h4 className="font-semibold text-yellow-900 mb-2">💡 Sistema Completamente Automatizado</h4>
        <p className="text-sm text-yellow-800">
          Este sistema ahora funciona completamente de forma automática. No necesitas realizar ninguna acción manual.
          Todos los datos se sincronizan automáticamente con Azure Blob Storage.
        </p>
      </div>

      {/* Debug Info (solo en desarrollo) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h5 className="font-semibold text-gray-900 mb-2">🔧 Información de Debug:</h5>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Estado actual:</strong> {syncStatus}</p>
            <p><strong>Mensaje:</strong> {message || 'Sin mensaje'}</p>
            <p><strong>Última sync:</strong> {lastSync || 'Nunca'}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataManagement; 