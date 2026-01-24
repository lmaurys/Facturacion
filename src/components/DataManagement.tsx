import React, { useState, useEffect } from 'react';
import { Database, UserPlus, Pencil, Save, X, ToggleLeft, ToggleRight, Trash2, AlertCircle, Download } from 'lucide-react';
import { Instructor, IssuerProfile, TransferOptionProfile, InvoiceNumberingSettings, InvoiceFooterNote } from '../types';
import {
  loadInstructors,
  addInstructor,
  updateInstructor,
  deleteInstructor,
  exportAllData,
  clearAllData,
  loadIssuerProfiles,
  addIssuerProfile,
  updateIssuerProfile,
  deleteIssuerProfile,
  loadTransferOptions,
  addTransferOption,
  updateTransferOption,
  deleteTransferOption,
  loadInvoiceNumberingSettings,
  updateInvoiceNumberingSettings,
  loadInvoiceFooterNotes,
  addInvoiceFooterNote,
  updateInvoiceFooterNote,
  deleteInvoiceFooterNote,
  initializeFromAzure,
  createBlankRemoteJson
} from '../utils/storage';
import {
  ensureBlobPublicUrl,
  ensureBlobSasUrl,
  getAzureBlobConfig,
  isContainerSasUrl,
  setAzureBlobConfig
} from '../utils/azureBlobConfig';

export type DataManagementSection =
  | 'datos'
  | 'numeracion'
  | 'nota-legal'
  | 'instructores'
  | 'emisores'
  | 'opciones-transferencia';

interface DataManagementProps {
  section?: DataManagementSection;
  embedded?: boolean;
}

const DataManagement: React.FC<DataManagementProps> = ({ section, embedded }) => {
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [systemStatus, setSystemStatus] = useState<'loading' | 'active' | 'error'>('loading');
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [newInstructor, setNewInstructor] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  const [issuers, setIssuers] = useState<IssuerProfile[]>([]);
  const [newIssuer, setNewIssuer] = useState<Omit<IssuerProfile, 'id'>>({
    label: '',
    name: '',
    nit: '',
    address: '',
    phone: '',
    city: '',
    email: '',
    logoUrl: '',
    logoDataUrl: ''
  });
  const [editingIssuerId, setEditingIssuerId] = useState<string | null>(null);
  const [editingIssuer, setEditingIssuer] = useState<Omit<IssuerProfile, 'id'>>({
    label: '',
    name: '',
    nit: '',
    address: '',
    phone: '',
    city: '',
    email: '',
    logoUrl: '',
    logoDataUrl: ''
  });

  const [transferOptions, setTransferOptions] = useState<TransferOptionProfile[]>([]);
  const [newTransfer, setNewTransfer] = useState<Omit<TransferOptionProfile, 'id'>>({
    label: '',
    bankName: '',
    bankAddress: '',
    country: '',
    swiftCode: '',
    accountOwner: '',
    accountNumber: { es: '', en: '' },
    accountOwnerAddress: '',
    routingNumber: '',
    abaCode: ''
  });
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<Omit<TransferOptionProfile, 'id'>>({
    label: '',
    bankName: '',
    bankAddress: '',
    country: '',
    swiftCode: '',
    accountOwner: '',
    accountNumber: { es: '', en: '' },
    accountOwnerAddress: '',
    routingNumber: '',
    abaCode: ''
  });
  const [message, setMessage] = useState<string>('');
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [clearConfirmText, setClearConfirmText] = useState<string>('');
  const [clearConfirmChecked, setClearConfirmChecked] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const [azurePublicUrl, setAzurePublicUrl] = useState<string>('');
  const [azureSasUrl, setAzureSasUrl] = useState<string>('');
  const [azureBlobName, setAzureBlobName] = useState<string>('');
  const [isSavingAzureConfig, setIsSavingAzureConfig] = useState<boolean>(false);
  const [isReloadingFromAzure, setIsReloadingFromAzure] = useState<boolean>(false);

  const [invoiceNumbering, setInvoiceNumbering] = useState<InvoiceNumberingSettings>({ prefix: '', startNumber: 1, nextNumber: 1 });
  const [invoicePrefix, setInvoicePrefix] = useState<string>('');
  const [invoiceNextNumber, setInvoiceNextNumber] = useState<string>('1');
  const [isSavingInvoiceNumbering, setIsSavingInvoiceNumbering] = useState<boolean>(false);

  const [invoiceFooterNotes, setInvoiceFooterNotes] = useState<InvoiceFooterNote[]>([]);
  const [newFooterEffectiveFrom, setNewFooterEffectiveFrom] = useState<string>('');
  const [newFooterEs, setNewFooterEs] = useState<string>('');
  const [newFooterEn, setNewFooterEn] = useState<string>('');
  const [editingFooterId, setEditingFooterId] = useState<string | null>(null);
  const [editingFooterEffectiveFrom, setEditingFooterEffectiveFrom] = useState<string>('');
  const [editingFooterEs, setEditingFooterEs] = useState<string>('');
  const [editingFooterEn, setEditingFooterEn] = useState<string>('');
  const [isSavingFooter, setIsSavingFooter] = useState<boolean>(false);

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

    // Cargar configuración de conexión Azure (si existe)
    try {
      const cfg = getAzureBlobConfig();
      if (cfg?.publicUrl) setAzurePublicUrl(cfg.publicUrl);
      if (cfg?.blobUrlWithSas) setAzureSasUrl(cfg.blobUrlWithSas);
      if (cfg?.blobName) setAzureBlobName(cfg.blobName);
    } catch {
      // noop
    }

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

    const refreshIssuers = async () => {
      const data = await loadIssuerProfiles();
      setIssuers(data);
    };
    refreshIssuers();

    const refreshTransfers = async () => {
      const data = await loadTransferOptions();
      setTransferOptions(data);
    };
    refreshTransfers();

    const refreshInvoiceNumbering = async () => {
      const data = await loadInvoiceNumberingSettings();
      setInvoiceNumbering(data);
      setInvoicePrefix(data.prefix);
      setInvoiceNextNumber(String(data.nextNumber ?? data.startNumber));
    };
    refreshInvoiceNumbering();

    const refreshInvoiceFooterNotes = async () => {
      const data = await loadInvoiceFooterNotes();
      setInvoiceFooterNotes(data);
    };
    refreshInvoiceFooterNotes();

    // Escuchar eventos de actualización
    window.addEventListener('courseUpdated', handleDataUpdate);
    window.addEventListener('clientUpdated', handleDataUpdate);
    window.addEventListener('invoiceUpdated', handleDataUpdate);
    window.addEventListener('azureSyncSuccess', handleDataUpdate);
    window.addEventListener('instructorUpdated', refreshInstructors);
    window.addEventListener('issuerUpdated', refreshIssuers);
    window.addEventListener('transferOptionUpdated', refreshTransfers);
    window.addEventListener('invoiceNumberingUpdated', refreshInvoiceNumbering);
    window.addEventListener('invoiceFooterNotesUpdated', refreshInvoiceFooterNotes);

    return () => {
      window.removeEventListener('courseUpdated', handleDataUpdate);
      window.removeEventListener('clientUpdated', handleDataUpdate);
      window.removeEventListener('invoiceUpdated', handleDataUpdate);
      window.removeEventListener('azureSyncSuccess', handleDataUpdate);
      window.removeEventListener('instructorUpdated', refreshInstructors);
      window.removeEventListener('issuerUpdated', refreshIssuers);
      window.removeEventListener('transferOptionUpdated', refreshTransfers);
      window.removeEventListener('invoiceNumberingUpdated', refreshInvoiceNumbering);
      window.removeEventListener('invoiceFooterNotesUpdated', refreshInvoiceFooterNotes);
    };
  }, []);

  const saveAzureConnection = async (opts?: { reload?: boolean }) => {
    setMessage('');
    setIsSavingAzureConfig(true);
    try {
      const finalBlobSas = ensureBlobSasUrl(azureSasUrl, azureBlobName);
      const finalPublic = ensureBlobPublicUrl(azurePublicUrl || azureSasUrl, azureBlobName);

      if (!finalBlobSas) {
        setMessage('Debes ingresar una URL con SAS válida (puede ser de container o de blob).');
        return;
      }
      if (isContainerSasUrl(azureSasUrl) && !azureBlobName.trim()) {
        setMessage('Tu SAS apunta al container (sr=c). Debes indicar el nombre del archivo JSON (blob).');
        return;
      }

      setAzureBlobConfig({
        publicUrl: finalPublic ?? '',
        blobUrlWithSas: finalBlobSas,
        blobName: azureBlobName
      });

      if (opts?.reload) {
        setIsReloadingFromAzure(true);
        try {
          const ok = await initializeFromAzure();
          setMessage(
            ok
              ? 'Conexión guardada. Datos recargados desde Azure.'
              : 'Conexión guardada, pero no se pudo recargar desde Azure. Si el archivo aún no existe en ese storage, usa “Crear JSON vacío”.'
          );
        } finally {
          setIsReloadingFromAzure(false);
        }
      } else {
        setMessage('Conexión guardada. Se usará en las próximas cargas/guardados a Azure.');
      }
    } catch (e) {
      console.error(e);
      setMessage('No se pudo guardar la conexión de Azure.');
    } finally {
      setIsSavingAzureConfig(false);
    }
  };

  const handleCreateBlankRemoteJson = async () => {
    setMessage('');
    if (!confirm('Esto creará un JSON nuevo en ese Blob (y podría sobrescribir si ya existe). ¿Continuar?')) return;

    setIsSavingAzureConfig(true);
    try {
      const finalBlobSas = ensureBlobSasUrl(azureSasUrl, azureBlobName);
      const finalPublic = ensureBlobPublicUrl(azurePublicUrl || azureSasUrl, azureBlobName);

      if (!finalBlobSas) {
        setMessage('Debes ingresar una URL con SAS válida (puede ser de container o de blob).');
        return;
      }
      if (isContainerSasUrl(azureSasUrl) && !azureBlobName.trim()) {
        setMessage('Tu SAS apunta al container (sr=c). Debes indicar el nombre del archivo JSON (blob).');
        return;
      }

      setAzureBlobConfig({
        publicUrl: finalPublic ?? '',
        blobUrlWithSas: finalBlobSas,
        blobName: azureBlobName
      });

      const okCreate = await createBlankRemoteJson();
      if (!okCreate) {
        setMessage('No se pudo crear el JSON en blanco. Revisa la URL con SAS y permisos.');
        return;
      }

      setIsReloadingFromAzure(true);
      try {
        const okLoad = await initializeFromAzure();
        setMessage(okLoad ? 'JSON vacío creado y datos cargados.' : 'JSON vacío creado, pero no se pudo cargar automáticamente.');
      } finally {
        setIsReloadingFromAzure(false);
      }
    } catch (e) {
      console.error(e);
      setMessage('Error creando el JSON en blanco.');
    } finally {
      setIsSavingAzureConfig(false);
    }
  };

  const handleAddFooterNote = async () => {
    setMessage('');
    const effectiveFrom = newFooterEffectiveFrom.trim();
    if (!effectiveFrom) {
      setMessage('La fecha de vigencia (desde) es obligatoria.');
      return;
    }
    if (!newFooterEs.trim() && !newFooterEn.trim()) {
      setMessage('Debes ingresar el texto en Español y/o en Inglés.');
      return;
    }
    setIsSavingFooter(true);
    try {
      const created = await addInvoiceFooterNote({
        effectiveFrom,
        es: newFooterEs,
        en: newFooterEn
      });
      if (created) {
        setNewFooterEffectiveFrom('');
        setNewFooterEs('');
        setNewFooterEn('');
        setInvoiceFooterNotes(await loadInvoiceFooterNotes());
        setMessage('Nota de pie de factura agregada.');
      } else {
        setMessage('No se pudo agregar la nota de pie de factura.');
      }
    } finally {
      setIsSavingFooter(false);
    }
  };

  const startEditFooterNote = (note: InvoiceFooterNote) => {
    setEditingFooterId(note.id);
    setEditingFooterEffectiveFrom(note.effectiveFrom);
    setEditingFooterEs(note.es);
    setEditingFooterEn(note.en);
  };

  const saveFooterEdit = async () => {
    if (!editingFooterId) return;
    setMessage('');
    if (!editingFooterEffectiveFrom.trim()) {
      setMessage('La fecha de vigencia (desde) es obligatoria.');
      return;
    }
    if (!editingFooterEs.trim() && !editingFooterEn.trim()) {
      setMessage('Debes ingresar el texto en Español y/o en Inglés.');
      return;
    }
    setIsSavingFooter(true);
    try {
      const updated = await updateInvoiceFooterNote(editingFooterId, {
        effectiveFrom: editingFooterEffectiveFrom,
        es: editingFooterEs,
        en: editingFooterEn
      });
      if (updated) {
        setEditingFooterId(null);
        setInvoiceFooterNotes(await loadInvoiceFooterNotes());
        setMessage('Nota de pie de factura actualizada.');
      } else {
        setMessage('No se pudo actualizar la nota de pie de factura.');
      }
    } finally {
      setIsSavingFooter(false);
    }
  };

  const removeFooterNote = async (note: InvoiceFooterNote) => {
    if (!confirm(`¿Eliminar la nota vigente desde ${note.effectiveFrom}?`)) return;
    await deleteInvoiceFooterNote(note.id);
    setInvoiceFooterNotes(await loadInvoiceFooterNotes());
  };

  const saveInvoiceNumbering = async () => {
    setMessage('');
    const prefix = invoicePrefix.trim();
    const nextNumberNum = Number(invoiceNextNumber);

    if (!prefix) {
      setMessage('El prefijo de factura es obligatorio.');
      return;
    }
    if (!Number.isFinite(nextNumberNum) || nextNumberNum < 1) {
      setMessage('El siguiente consecutivo debe ser un número >= 1.');
      return;
    }

    setIsSavingInvoiceNumbering(true);
    try {
      const updated = await updateInvoiceNumberingSettings({
        prefix,
        startNumber: Math.floor(nextNumberNum),
        nextNumber: Math.floor(nextNumberNum)
      });
      if (updated) {
        setInvoiceNumbering(updated);
        setInvoicePrefix(updated.prefix);
        setInvoiceNextNumber(String(updated.nextNumber ?? updated.startNumber));
        setMessage('Numeración de facturas actualizada.');
      } else {
        setMessage('No se pudo actualizar la numeración de facturas.');
      }
    } finally {
      setIsSavingInvoiceNumbering(false);
    }
  };

  const handleAddIssuer = async () => {
    setMessage('');
    if (!newIssuer.label.trim()) return;
    const created = await addIssuerProfile(newIssuer);
    if (created) {
      setNewIssuer({ label: '', name: '', nit: '', address: '', phone: '', city: '', email: '', logoUrl: '', logoDataUrl: '' });
      setMessage('Emisor agregado.');
      setIssuers(await loadIssuerProfiles());
    } else {
      setMessage('No se pudo agregar el emisor.');
    }
  };

  const startEditIssuer = (issuer: IssuerProfile) => {
    setEditingIssuerId(issuer.id);
    const { id: _id, ...rest } = issuer;
    setEditingIssuer(rest);
  };

  const saveIssuerEdit = async () => {
    if (!editingIssuerId) return;
    const updated = await updateIssuerProfile(editingIssuerId, editingIssuer);
    if (updated) {
      setEditingIssuerId(null);
      setMessage('Emisor actualizado.');
      setIssuers(await loadIssuerProfiles());
    } else {
      setMessage('No se pudo actualizar el emisor.');
    }
  };

  const removeIssuer = async (issuer: IssuerProfile) => {
    if (!confirm(`¿Eliminar emisor "${issuer.label}"? (Si está en uso por facturas, no se permite)`)) return;
    const res = await deleteIssuerProfile(issuer.id);
    setIssuers(await loadIssuerProfiles());
    if (!res.removed && res.reason === 'in-use') {
      setMessage('El emisor está en uso por facturas: no se puede eliminar.');
    }
  };

  const handleAddTransfer = async () => {
    setMessage('');
    if (!newTransfer.label.trim()) return;
    const created = await addTransferOption({
      ...newTransfer,
      routingNumber: newTransfer.routingNumber?.trim() || undefined,
      abaCode: newTransfer.abaCode?.trim() || undefined
    });
    if (created) {
      setNewTransfer({
        label: '',
        bankName: '',
        bankAddress: '',
        country: '',
        swiftCode: '',
        accountOwner: '',
        accountNumber: { es: '', en: '' },
        accountOwnerAddress: '',
        routingNumber: '',
        abaCode: ''
      });
      setMessage('Opción de transferencia agregada.');
      setTransferOptions(await loadTransferOptions());
    } else {
      setMessage('No se pudo agregar la opción de transferencia.');
    }
  };

  const startEditTransfer = (opt: TransferOptionProfile) => {
    setEditingTransferId(opt.id);
    const { id: _id, ...rest } = opt;
    setEditingTransfer({
      ...rest,
      routingNumber: rest.routingNumber || '',
      abaCode: rest.abaCode || ''
    });
  };

  const saveTransferEdit = async () => {
    if (!editingTransferId) return;
    const updated = await updateTransferOption(editingTransferId, {
      ...editingTransfer,
      routingNumber: editingTransfer.routingNumber?.trim() || undefined,
      abaCode: editingTransfer.abaCode?.trim() || undefined
    });
    if (updated) {
      setEditingTransferId(null);
      setMessage('Opción de transferencia actualizada.');
      setTransferOptions(await loadTransferOptions());
    } else {
      setMessage('No se pudo actualizar la opción de transferencia.');
    }
  };

  const removeTransfer = async (opt: TransferOptionProfile) => {
    if (!confirm(`¿Eliminar opción de transferencia "${opt.label}"? (Si está en uso por facturas, no se permite)`)) return;
    const res = await deleteTransferOption(opt.id);
    setTransferOptions(await loadTransferOptions());
    if (!res.removed && res.reason === 'in-use') {
      setMessage('La opción de transferencia está en uso por facturas: no se puede eliminar.');
    }
  };

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

  const showAll = !section;
  const showDatos = showAll || section === 'datos';
  const showNumeracion = showAll || section === 'numeracion';
  const showNotaLegal = showAll || section === 'nota-legal';
  const showInstructores = showAll || section === 'instructores';
  const showEmisores = showAll || section === 'emisores';
  const showOpcionesTransferencia = showAll || section === 'opciones-transferencia';

  const content = (
    <>
      {!embedded && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="flex items-center">
            <Database className="mr-3 text-blue-600" size={24} />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Gestión Central de Datos</h2>
              <p className="text-sm text-gray-600">Sistema de gestión y sincronización de datos</p>
            </div>
          </div>
        </div>
      )}

      {message && !showDatos && (
        <div className="bg-white shadow-md rounded-lg p-4 mb-4">
          <div className="flex items-center text-sm text-gray-700">
            <AlertCircle size={16} className="mr-2 text-amber-500" />
            {message}
          </div>
        </div>
      )}

      {showDatos && (
        <>

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
            <h3 className="text-lg font-semibold text-gray-900">Conexión Azure (JSON remoto)</h3>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del archivo JSON (blob)</label>
              <input
                value={azureBlobName}
                onChange={(e) => setAzureBlobName(e.target.value)}
                placeholder="Ej: facturacion.json"
                aria-label="Nombre del blob JSON"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Si tu SAS es de container (sr=c), este nombre es obligatorio.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">URL con SAS (lectura/escritura)</label>
              <input
                value={azureSasUrl}
                onChange={(e) => setAzureSasUrl(e.target.value)}
                placeholder="https://<account>.blob.core.windows.net/<container>?<sas>  (o  /<blob>.json?<sas>)"
                aria-label="URL con SAS"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Puede ser SAS del container (sr=c) o del blob (sr=b). Debe permitir escritura (PUT) para poder crear/guardar.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">URL pública (solo lectura) (opcional)</label>
              <input
                value={azurePublicUrl}
                onChange={(e) => setAzurePublicUrl(e.target.value)}
                placeholder="https://<account>.blob.core.windows.net/<container>/<blob>.json"
                aria-label="URL pública"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Si la dejas vacía, se construirá automáticamente desde la URL con SAS + nombre del archivo.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={() => saveAzureConnection({ reload: false })}
                disabled={isSavingAzureConfig || isReloadingFromAzure}
                className="inline-flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
                title="Guardar conexión"
              >
                <Save size={16} className="mr-2" />
                {isSavingAzureConfig ? 'Guardando…' : 'Guardar conexión'}
              </button>

              <button
                onClick={() => saveAzureConnection({ reload: true })}
                disabled={isSavingAzureConfig || isReloadingFromAzure}
                className="inline-flex items-center justify-center px-3 py-2 bg-gray-900 text-white rounded-md hover:bg-black disabled:opacity-60"
                title="Guardar y recargar desde Azure"
              >
                <Database size={16} className="mr-2" />
                {isReloadingFromAzure ? 'Recargando…' : 'Guardar y recargar'}
              </button>

              <button
                onClick={handleCreateBlankRemoteJson}
                disabled={isSavingAzureConfig || isReloadingFromAzure}
                className="inline-flex items-center justify-center px-3 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-60"
                title="Crear JSON vacío en el Blob"
              >
                <Trash2 size={16} className="mr-2" />
                Crear JSON vacío
              </button>
            </div>

            <p className="text-xs text-gray-500">
              “Crear JSON vacío” crea un archivo mínimo: solo <span className="font-medium">courses</span>, <span className="font-medium">clients</span> e <span className="font-medium">invoices</span> (vacíos) + metadatos.
              No incluye emisores, opciones de transferencia, numeración, notas legales, instructores, etc.
            </p>
          </div>
        </div>

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
        </>
      )}

        {/* Numeración de Facturas */}
        {showNumeracion && (
        <div className="bg-white shadow-md rounded-lg p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Numeración de Facturas</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Prefijo</label>
              <input
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="Ej: LP"
                aria-label="Prefijo de factura"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Siguiente consecutivo</label>
              <input
                value={invoiceNextNumber}
                onChange={(e) => setInvoiceNextNumber(e.target.value)}
                placeholder="Ej: 101"
                inputMode="numeric"
                aria-label="Siguiente consecutivo de factura"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Se usará como siguiente número al guardar/generar una factura (nunca baja por debajo del máximo existente).
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={saveInvoiceNumbering}
                disabled={isSavingInvoiceNumbering || (invoicePrefix.trim() === invoiceNumbering.prefix && invoiceNextNumber.trim() === String(invoiceNumbering.nextNumber ?? invoiceNumbering.startNumber))}
                className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
                title="Guardar numeración"
              >
                <Save size={16} className="mr-2" />
                {isSavingInvoiceNumbering ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Nota legal (Pie de factura) */}
        {showNotaLegal && (
        <div className="bg-white shadow-md rounded-lg p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Nota legal (Pie de factura)</h3>
          </div>

          <div className="grid grid-cols-1 gap-3 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vigente desde</label>
                <input
                  type="date"
                  value={newFooterEffectiveFrom}
                  onChange={(e) => setNewFooterEffectiveFrom(e.target.value)}
                  aria-label="Vigente desde"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2 flex justify-end items-end">
                <button
                  onClick={handleAddFooterNote}
                  disabled={isSavingFooter}
                  className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
                  title="Agregar nota"
                >
                  <UserPlus size={16} className="mr-2" />
                  {isSavingFooter ? 'Guardando…' : 'Agregar'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Texto (ES)</label>
                <textarea
                  value={newFooterEs}
                  onChange={(e) => setNewFooterEs(e.target.value)}
                  aria-label="Texto ES"
                  rows={4}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Text (EN)</label>
                <textarea
                  value={newFooterEn}
                  onChange={(e) => setNewFooterEn(e.target.value)}
                  aria-label="Texto EN"
                  rows={4}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              La factura mostrará la nota según la fecha de emisión y el idioma.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vigente desde</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ES</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EN</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoiceFooterNotes.map(note => (
                  <tr key={note.id}>
                    <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{note.effectiveFrom}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{note.es ? `${note.es.slice(0, 80)}${note.es.length > 80 ? '…' : ''}` : '-'}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{note.en ? `${note.en.slice(0, 80)}${note.en.length > 80 ? '…' : ''}` : '-'}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <button onClick={() => startEditFooterNote(note)} className="text-blue-600 hover:text-blue-800" title="Editar"><Pencil size={16} /></button>
                        <button onClick={() => removeFooterNote(note)} className="text-red-600 hover:text-red-800" title="Eliminar"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {invoiceFooterNotes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500">No hay notas configuradas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {editingFooterId && (
            <div className="mt-4 border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">Editar nota</h4>
                <div className="flex gap-2">
                  <button onClick={saveFooterEdit} disabled={isSavingFooter} className="text-green-600 hover:text-green-800 disabled:opacity-60" title="Guardar"><Save size={16} /></button>
                  <button onClick={() => setEditingFooterId(null)} disabled={isSavingFooter} className="text-gray-600 hover:text-gray-800 disabled:opacity-60" title="Cancelar"><X size={16} /></button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Vigente desde</label>
                  <input
                    type="date"
                    value={editingFooterEffectiveFrom}
                    onChange={(e) => setEditingFooterEffectiveFrom(e.target.value)}
                    aria-label="Editar vigente desde"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Texto (ES)</label>
                  <textarea aria-label="Editar texto ES" value={editingFooterEs} onChange={(e) => setEditingFooterEs(e.target.value)} rows={4} className="w-full px-3 py-2 border rounded-md" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Text (EN)</label>
                  <textarea aria-label="Editar texto EN" value={editingFooterEn} onChange={(e) => setEditingFooterEn(e.target.value)} rows={4} className="w-full px-3 py-2 border rounded-md" />
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Administración de Instructores */}
        {showInstructores && (
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
        )}

        {/* Administración de Emisores */}
        {showEmisores && (
        <div className="bg-white shadow-md rounded-lg p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Emisores</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <input
              value={newIssuer.label}
              onChange={(e) => setNewIssuer(prev => ({ ...prev, label: e.target.value }))}
              placeholder="Etiqueta (ej: Colombia, USA)"
              aria-label="Etiqueta del emisor"
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={newIssuer.name}
              onChange={(e) => setNewIssuer(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Nombre"
              aria-label="Nombre del emisor"
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={newIssuer.nit}
              onChange={(e) => setNewIssuer(prev => ({ ...prev, nit: e.target.value }))}
              placeholder="NIT / ITIN"
              aria-label="NIT del emisor"
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={newIssuer.email}
              onChange={(e) => setNewIssuer(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
              aria-label="Email del emisor"
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={newIssuer.phone}
              onChange={(e) => setNewIssuer(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="Teléfono"
              aria-label="Teléfono del emisor"
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={newIssuer.city}
              onChange={(e) => setNewIssuer(prev => ({ ...prev, city: e.target.value }))}
              placeholder="Ciudad"
              aria-label="Ciudad del emisor"
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={newIssuer.address}
              onChange={(e) => setNewIssuer(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Dirección"
              aria-label="Dirección del emisor"
              className="md:col-span-2 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <input
              value={(newIssuer.logoDataUrl || '')}
              onChange={(e) => setNewIssuer(prev => ({ ...prev, logoDataUrl: e.target.value }))}
              placeholder="Logo (Data URL: data:image/...)"
              aria-label="Logo del emisor (Data URL)"
              className="md:col-span-2 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={(newIssuer.logoUrl || '')}
              onChange={(e) => setNewIssuer(prev => ({ ...prev, logoUrl: e.target.value }))}
              placeholder="Logo (URL)"
              aria-label="Logo del emisor (URL)"
              className="md:col-span-2 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end mb-4">
            <button
              onClick={handleAddIssuer}
              className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              title="Agregar emisor"
            >
              <UserPlus size={16} className="mr-2" /> Agregar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Etiqueta</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NIT</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {issuers.map(issuer => (
                  <tr key={issuer.id}>
                    <td className="px-3 py-2 text-sm text-gray-900">{issuer.label}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{issuer.name}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{issuer.nit}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <button onClick={() => startEditIssuer(issuer)} className="text-blue-600 hover:text-blue-800" title="Editar"><Pencil size={16} /></button>
                        <button onClick={() => removeIssuer(issuer)} className="text-red-600 hover:text-red-800" title="Eliminar"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {issuers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500">No hay emisores configurados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {editingIssuerId && (
            <div className="mt-4 border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">Editar emisor</h4>
                <div className="flex gap-2">
                  <button onClick={saveIssuerEdit} className="text-green-600 hover:text-green-800" title="Guardar"><Save size={16} /></button>
                  <button onClick={() => { setEditingIssuerId(null); }} className="text-gray-600 hover:text-gray-800" title="Cancelar"><X size={16} /></button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={editingIssuer.label}
                  onChange={(e) => setEditingIssuer(prev => ({ ...prev, label: e.target.value }))}
                  className="px-3 py-2 border rounded-md"
                  placeholder="Etiqueta"
                />
                <input
                  value={editingIssuer.name}
                  onChange={(e) => setEditingIssuer(prev => ({ ...prev, name: e.target.value }))}
                  className="px-3 py-2 border rounded-md"
                  placeholder="Nombre"
                />
                <input
                  value={editingIssuer.nit}
                  onChange={(e) => setEditingIssuer(prev => ({ ...prev, nit: e.target.value }))}
                  className="px-3 py-2 border rounded-md"
                  placeholder="NIT / ITIN"
                />
                <input
                  value={editingIssuer.email}
                  onChange={(e) => setEditingIssuer(prev => ({ ...prev, email: e.target.value }))}
                  className="px-3 py-2 border rounded-md"
                  placeholder="Email"
                />
                <input
                  value={editingIssuer.phone}
                  onChange={(e) => setEditingIssuer(prev => ({ ...prev, phone: e.target.value }))}
                  className="px-3 py-2 border rounded-md"
                  placeholder="Teléfono"
                />
                <input
                  value={editingIssuer.city}
                  onChange={(e) => setEditingIssuer(prev => ({ ...prev, city: e.target.value }))}
                  className="px-3 py-2 border rounded-md"
                  placeholder="Ciudad"
                />
                <input
                  value={editingIssuer.address}
                  onChange={(e) => setEditingIssuer(prev => ({ ...prev, address: e.target.value }))}
                  className="md:col-span-2 px-3 py-2 border rounded-md"
                  placeholder="Dirección"
                />

                <input
                  value={(editingIssuer.logoDataUrl || '')}
                  onChange={(e) => setEditingIssuer(prev => ({ ...prev, logoDataUrl: e.target.value }))}
                  className="md:col-span-2 px-3 py-2 border rounded-md"
                  placeholder="Logo (Data URL: data:image/...)"
                />
                <input
                  value={(editingIssuer.logoUrl || '')}
                  onChange={(e) => setEditingIssuer(prev => ({ ...prev, logoUrl: e.target.value }))}
                  className="md:col-span-2 px-3 py-2 border rounded-md"
                  placeholder="Logo (URL)"
                />
              </div>
            </div>
          )}
        </div>
        )}

        {/* Administración de Opciones de Transferencia */}
        {showOpcionesTransferencia && (
        <div className="bg-white shadow-md rounded-lg p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Opciones de Transferencia</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <input
              value={newTransfer.label}
              onChange={(e) => setNewTransfer(prev => ({ ...prev, label: e.target.value }))}
              placeholder="Etiqueta (ej: Cuenta Colombia)"
              aria-label="Etiqueta de transferencia"
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={newTransfer.bankName}
              onChange={(e) => setNewTransfer(prev => ({ ...prev, bankName: e.target.value }))}
              placeholder="Nombre del banco"
              aria-label="Nombre del banco"
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={newTransfer.country}
              onChange={(e) => setNewTransfer(prev => ({ ...prev, country: e.target.value }))}
              placeholder="País"
              aria-label="País"
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={newTransfer.swiftCode}
              onChange={(e) => setNewTransfer(prev => ({ ...prev, swiftCode: e.target.value }))}
              placeholder="SWIFT"
              aria-label="Swift"
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={newTransfer.accountOwner}
              onChange={(e) => setNewTransfer(prev => ({ ...prev, accountOwner: e.target.value }))}
              placeholder="Titular"
              aria-label="Titular"
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={newTransfer.accountOwnerAddress}
              onChange={(e) => setNewTransfer(prev => ({ ...prev, accountOwnerAddress: e.target.value }))}
              placeholder="Dirección del titular"
              aria-label="Dirección del titular"
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={newTransfer.accountNumber.es}
              onChange={(e) => setNewTransfer(prev => ({ ...prev, accountNumber: { ...prev.accountNumber, es: e.target.value } }))}
              placeholder="Cuenta (ES)"
              aria-label="Cuenta ES"
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={newTransfer.accountNumber.en}
              onChange={(e) => setNewTransfer(prev => ({ ...prev, accountNumber: { ...prev.accountNumber, en: e.target.value } }))}
              placeholder="Account (EN)"
              aria-label="Cuenta EN"
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={newTransfer.routingNumber || ''}
              onChange={(e) => setNewTransfer(prev => ({ ...prev, routingNumber: e.target.value }))}
              placeholder="Routing (opcional)"
              aria-label="Routing"
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={newTransfer.abaCode || ''}
              onChange={(e) => setNewTransfer(prev => ({ ...prev, abaCode: e.target.value }))}
              placeholder="ABA (opcional)"
              aria-label="ABA"
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={newTransfer.bankAddress}
              onChange={(e) => setNewTransfer(prev => ({ ...prev, bankAddress: e.target.value }))}
              placeholder="Dirección del banco"
              aria-label="Dirección del banco"
              className="md:col-span-2 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end mb-4">
            <button
              onClick={handleAddTransfer}
              className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              title="Agregar opción de transferencia"
            >
              <UserPlus size={16} className="mr-2" /> Agregar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Etiqueta</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Banco</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">País</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transferOptions.map(opt => (
                  <tr key={opt.id}>
                    <td className="px-3 py-2 text-sm text-gray-900">{opt.label}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{opt.bankName}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{opt.country}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <button onClick={() => startEditTransfer(opt)} className="text-blue-600 hover:text-blue-800" title="Editar"><Pencil size={16} /></button>
                        <button onClick={() => removeTransfer(opt)} className="text-red-600 hover:text-red-800" title="Eliminar"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {transferOptions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500">No hay opciones de transferencia configuradas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {editingTransferId && (
            <div className="mt-4 border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">Editar opción de transferencia</h4>
                <div className="flex gap-2">
                  <button onClick={saveTransferEdit} className="text-green-600 hover:text-green-800" title="Guardar"><Save size={16} /></button>
                  <button onClick={() => { setEditingTransferId(null); }} className="text-gray-600 hover:text-gray-800" title="Cancelar"><X size={16} /></button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={editingTransfer.label} onChange={(e) => setEditingTransfer(prev => ({ ...prev, label: e.target.value }))} className="px-3 py-2 border rounded-md" placeholder="Etiqueta" />
                <input value={editingTransfer.bankName} onChange={(e) => setEditingTransfer(prev => ({ ...prev, bankName: e.target.value }))} className="px-3 py-2 border rounded-md" placeholder="Banco" />
                <input value={editingTransfer.country} onChange={(e) => setEditingTransfer(prev => ({ ...prev, country: e.target.value }))} className="px-3 py-2 border rounded-md" placeholder="País" />
                <input value={editingTransfer.swiftCode} onChange={(e) => setEditingTransfer(prev => ({ ...prev, swiftCode: e.target.value }))} className="px-3 py-2 border rounded-md" placeholder="SWIFT" />
                <input value={editingTransfer.accountOwner} onChange={(e) => setEditingTransfer(prev => ({ ...prev, accountOwner: e.target.value }))} className="px-3 py-2 border rounded-md" placeholder="Titular" />
                <input value={editingTransfer.accountOwnerAddress} onChange={(e) => setEditingTransfer(prev => ({ ...prev, accountOwnerAddress: e.target.value }))} className="px-3 py-2 border rounded-md" placeholder="Dirección del titular" />
                <input value={editingTransfer.accountNumber.es} onChange={(e) => setEditingTransfer(prev => ({ ...prev, accountNumber: { ...prev.accountNumber, es: e.target.value } }))} className="px-3 py-2 border rounded-md" placeholder="Cuenta (ES)" />
                <input value={editingTransfer.accountNumber.en} onChange={(e) => setEditingTransfer(prev => ({ ...prev, accountNumber: { ...prev.accountNumber, en: e.target.value } }))} className="px-3 py-2 border rounded-md" placeholder="Account (EN)" />
                <input value={editingTransfer.routingNumber || ''} onChange={(e) => setEditingTransfer(prev => ({ ...prev, routingNumber: e.target.value }))} className="px-3 py-2 border rounded-md" placeholder="Routing (opcional)" />
                <input value={editingTransfer.abaCode || ''} onChange={(e) => setEditingTransfer(prev => ({ ...prev, abaCode: e.target.value }))} className="px-3 py-2 border rounded-md" placeholder="ABA (opcional)" />
                <input value={editingTransfer.bankAddress} onChange={(e) => setEditingTransfer(prev => ({ ...prev, bankAddress: e.target.value }))} className="md:col-span-2 px-3 py-2 border rounded-md" placeholder="Dirección del banco" />
              </div>
            </div>
          )}
        </div>
        )}
      {showDatos && showClearConfirm && (
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
    </>
  );

  return embedded ? (
    <div className="max-w-4xl mx-auto">{content}</div>
  ) : (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">{content}</div>
    </div>
  );
};

export default DataManagement; 