import React, { useState, useEffect } from 'react';
import { Database, UserPlus, Pencil, Save, X, ToggleLeft, ToggleRight, Trash2, AlertCircle, Download } from 'lucide-react';
import { Instructor } from '../types';
import { loadInstructors, addInstructor, updateInstructor, deleteInstructor, exportAllData, clearAllData } from '../utils/storage';

const DataManagement: React.FC = () => {
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [systemStatus, setSystemStatus] = useState<'loading' | 'active' | 'error'>('loading');
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [newInstructor, setNewInstructor] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [clearConfirmText, setClearConfirmText] = useState<string>('');
  const [clearConfirmChecked, setClearConfirmChecked] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

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

    // Cargar instructores
    const refreshInstructors = async () => {
      const data = await loadInstructors();
      setInstructors(data);
    };
    refreshInstructors();

    // Escuchar eventos de actualización
    window.addEventListener('courseUpdated', handleDataUpdate);
    window.addEventListener('clientUpdated', handleDataUpdate);
    window.addEventListener('invoiceUpdated', handleDataUpdate);
    window.addEventListener('azureSyncSuccess', handleDataUpdate);
    window.addEventListener('instructorUpdated', refreshInstructors);

    return () => {
      window.removeEventListener('courseUpdated', handleDataUpdate);
      window.removeEventListener('clientUpdated', handleDataUpdate);
      window.removeEventListener('invoiceUpdated', handleDataUpdate);
      window.removeEventListener('azureSyncSuccess', handleDataUpdate);
      window.removeEventListener('instructorUpdated', refreshInstructors);
    };
  }, []);

  const handleAddInstructor = async () => {
    setMessage('');
    const name = newInstructor.trim();
    if (!name) return;
    const created = await addInstructor({ name, active: true });
    if (created) {
      setNewInstructor('');
      setMessage('Instructor agregado.');
      const data = await loadInstructors();
      setInstructors(data);
    } else {
      setMessage('No se pudo agregar (posible duplicado).');
    }
  };

  const startEdit = (instr: Instructor) => {
    setEditingId(instr.id);
    setEditingName(instr.name);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) return;
    const updated = await updateInstructor(editingId, { name, active: instructors.find(i => i.id === editingId)?.active ?? true });
    if (updated) {
      setEditingId(null);
      setEditingName('');
      const data = await loadInstructors();
      setInstructors(data);
      setMessage('Instructor actualizado.');
    } else {
      setMessage('No se pudo actualizar (posible duplicado).');
    }
  };

  const toggleActive = async (instr: Instructor) => {
    const updated = await updateInstructor(instr.id, { name: instr.name, active: !instr.active });
    if (updated) {
      const data = await loadInstructors();
      setInstructors(data);
    }
  };

  const removeInstructor = async (instr: Instructor) => {
    if (!confirm(`¿Eliminar instructor "${instr.name}"? Si está en uso se desactivará.`)) return;
    const res = await deleteInstructor(instr.id);
    const data = await loadInstructors();
    setInstructors(data);
    if (!res.removed && res.reason === 'in-use-marked-inactive') {
      setMessage('El instructor estaba en uso: se marcó como inactivo.');
    }
  };

  const handleDownloadJson = async () => {
    try {
      setMessage('');
      setIsDownloading(true);
      const json = await exportAllData();
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const fileName = `facturacion-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setMessage('JSON descargado.');
    } catch (e) {
      console.error(e);
      setMessage('No se pudo descargar el JSON.');
    } finally {
      setIsDownloading(false);
    }
  };

  const openClearModal = () => {
    setMessage('');
    setClearConfirmText('');
    setClearConfirmChecked(false);
    setShowClearConfirm(true);
  };

  const closeClearModal = () => {
    if (isClearing) return;
    setShowClearConfirm(false);
    setClearConfirmText('');
    setClearConfirmChecked(false);
  };

  const confirmPhrase = 'BORRAR';
  const canConfirmClear = clearConfirmChecked && clearConfirmText.trim().toUpperCase() === confirmPhrase;

  const handleClearAllData = async () => {
    if (!canConfirmClear) return;
    setIsClearing(true);
    setMessage('');
    try {
      const ok = await clearAllData();
      if (!ok) {
        setMessage('No se pudieron limpiar los datos (falló el guardado en Azure).');
        return;
      }

      const data = await loadInstructors();
      setInstructors(data);
      setShowClearConfirm(false);
      setClearConfirmText('');
      setClearConfirmChecked(false);
      setMessage('Datos limpiados.');
    } catch (e) {
      console.error(e);
      setMessage('Error limpiando los datos.');
    } finally {
      setIsClearing(false);
    }
  };

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

        {/* Herramientas de Datos */}
        <div className="bg-white shadow-md rounded-lg p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Herramientas</h3>
            {message && (
              <div className="flex items-center text-sm text-gray-600">
                <AlertCircle size={16} className="mr-2 text-amber-500" />
                {message}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDownloadJson}
              disabled={isDownloading}
              className="inline-flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
              title="Descargar respaldo JSON"
            >
              <Download size={16} className="mr-2" />
              {isDownloading ? 'Descargando…' : 'Descargar JSON'}
            </button>

            <button
              onClick={openClearModal}
              className="inline-flex items-center justify-center px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              title="Limpiar todos los datos"
            >
              <Trash2 size={16} className="mr-2" />
              Limpiar datos
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Recomendación: descarga el JSON antes de limpiar.
          </p>
        </div>

        {/* Administración de Instructores */}
        <div className="bg-white shadow-md rounded-lg p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Instructores</h3>
            {/* Mensajes ahora se muestran en Herramientas */}
          </div>

          <div className="flex gap-2 mb-4">
            <input
              value={newInstructor}
              onChange={(e) => setNewInstructor(e.target.value)}
              placeholder="Nombre del instructor"
              aria-label="Nombre del instructor"
              className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddInstructor}
              className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              title="Agregar instructor"
            >
              <UserPlus size={16} className="mr-2" /> Agregar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {instructors.map(instr => (
                  <tr key={instr.id}>
                    <td className="px-3 py-2">
                      {editingId === instr.id ? (
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          aria-label="Editar nombre del instructor"
                          className="w-full px-2 py-1 border rounded"
                        />
                      ) : (
                        <span className="text-sm text-gray-900">{instr.name}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${instr.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {instr.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-2">
                        {editingId === instr.id ? (
                          <>
                            <button onClick={saveEdit} className="text-green-600 hover:text-green-800" title="Guardar"><Save size={16} /></button>
                            <button onClick={() => { setEditingId(null); setEditingName(''); }} className="text-gray-600 hover:text-gray-800" title="Cancelar"><X size={16} /></button>
                          </>
                        ) : (
                          <button onClick={() => startEdit(instr)} className="text-blue-600 hover:text-blue-800" title="Editar nombre"><Pencil size={16} /></button>
                        )}
                        <button onClick={() => toggleActive(instr)} className="text-amber-600 hover:text-amber-800" title={instr.active ? 'Desactivar' : 'Activar'}>
                          {instr.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                        <button onClick={() => removeInstructor(instr)} className="text-red-600 hover:text-red-800" title="Eliminar"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {instructors.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-sm text-gray-500">No hay instructores configurados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de confirmación de borrado */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-gray-900">Confirmar limpieza total</h4>
              <button
                onClick={closeClearModal}
                className="text-gray-600 hover:text-gray-800"
                title="Cerrar"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
              Esta acción borra TODOS los datos (cursos, clientes, facturas, instructores y calendarios) y los sobrescribe en Azure.
              No se puede deshacer.
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Escribe <span className="font-semibold">{confirmPhrase}</span> para habilitar el borrado
              </label>
              <input
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder={confirmPhrase}
                aria-label="Confirmación de borrado"
                disabled={isClearing}
              />

              <label className="flex items-center mt-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={clearConfirmChecked}
                  onChange={(e) => setClearConfirmChecked(e.target.checked)}
                  disabled={isClearing}
                />
                Entiendo que esta acción es irreversible
              </label>
            </div>

            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={closeClearModal}
                disabled={isClearing}
                className="px-3 py-2 rounded-md border text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearAllData}
                disabled={!canConfirmClear || isClearing}
                className="px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isClearing ? 'Limpiando…' : 'Borrar todo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataManagement; 