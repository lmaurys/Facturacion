import React, { useState, useEffect } from 'react';
import { Invoice, Item, Issuer, Language, TransferOption, Client } from '../types';
import { transferOptions, invoiceLabels } from '../constants/invoiceConstants';
import { loadClients } from '../utils/storage';
import { Plus, X, Edit2, Users, FileText, Settings, CreditCard } from 'lucide-react';

interface InvoiceFormProps {
  invoice: Invoice;
  updateInvoice: (invoice: Partial<Invoice>) => void;
  addItem: (item: Item) => void;
  editItem: (index: number, item: Item) => void;
  deleteItem: (index: number) => void;
  selectedIssuer: Issuer;
  setSelectedIssuer: (issuer: Issuer) => void;
  invoiceNumber: string;
  paymentTerms: number;
  setPaymentTerms: (terms: number) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  selectedTransfer: TransferOption;
  setSelectedTransfer: (transfer: TransferOption) => void;
  onGenerateFromCourses?: () => void;
  onClearInvoice?: () => void;
  onSaveInvoice?: () => void;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({
  invoice,
  updateInvoice,
  addItem,
  editItem,
  deleteItem,
  selectedIssuer,
  setSelectedIssuer,
  invoiceNumber,
  paymentTerms,
  setPaymentTerms,
  language,
  setLanguage,
  selectedTransfer,
  setSelectedTransfer,
  onGenerateFromCourses,
  onClearInvoice,
  onSaveInvoice,
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [newItem, setNewItem] = useState<Item>({
    description: '',
    quantity: 0,
    unitPrice: 0,
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [manualClientMode, setManualClientMode] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const loadedClients = await loadClients();
      setClients(loadedClients);
    };
    loadData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    updateInvoice({ [name]: value });
  };

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId) {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        updateInvoice({
          clientName: client.name,
          clientNIT: client.nit,
          clientAddress: client.address,
          clientPhone: client.phone,
          clientCity: client.city,
        });
      }
    } else {
      // Limpiar datos si no hay cliente seleccionado
      updateInvoice({
        clientName: '',
        clientNIT: '',
        clientAddress: '',
        clientPhone: '',
        clientCity: '',
      });
    }
  };

  const handleItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewItem((prev) => ({ ...prev, [name]: name === 'description' ? value : Number(value) }));
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItem.description.trim() && newItem.quantity > 0 && newItem.unitPrice > 0) {
      if (editingIndex !== null) {
        editItem(editingIndex, newItem);
        setEditingIndex(null);
      } else {
        addItem(newItem);
      }
      setNewItem({ description: '', quantity: 0, unitPrice: 0 });
    }
  };

  const handleEditItem = (index: number) => {
    setNewItem(invoice.items[index]);
    setEditingIndex(index);
  };

  const handleDeleteItem = (index: number) => {
    deleteItem(index);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const t = invoiceLabels[language];

  return (
    <div className="space-y-8">
      {/* Header con acciones */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <FileText className="h-6 w-6 text-blue-600 mr-2" />
            <h1 className="text-2xl font-bold text-gray-900">
              {language === 'es' ? 'Nueva Factura' : 'New Invoice'}
            </h1>
          </div>
          <div className="flex space-x-2">
            {onGenerateFromCourses && (
              <button
                onClick={onGenerateFromCourses}
                className="inline-flex items-center px-2 py-1 border border-blue-300 rounded-md text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title={language === 'es' ? 'Generar factura desde cursos existentes' : 'Generate invoice from existing courses'}
              >
                <Plus className="h-3 w-3 mr-1" />
                {language === 'es' ? 'Desde Cursos' : 'From Courses'}
              </button>
            )}
            {onSaveInvoice && (
              <button
                onClick={onSaveInvoice}
                className="inline-flex items-center px-2 py-1 border border-green-300 rounded-md text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={!invoice.clientName || invoice.items.length === 0}
                title={language === 'es' ? 'Guardar factura actual' : 'Save current invoice'}
              >
                <FileText className="h-3 w-3 mr-1" />
                {language === 'es' ? 'Guardar Factura' : 'Save Invoice'}
              </button>
            )}
            {onClearInvoice && (
              <button
                onClick={onClearInvoice}
                className="inline-flex items-center px-2 py-1 border border-red-300 rounded-md text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                title={language === 'es' ? 'Limpiar toda la factura' : 'Clear entire invoice'}
              >
                <X className="h-3 w-3 mr-1" />
                {language === 'es' ? 'Limpiar' : 'Clear'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Configuración General */}
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <Settings className="h-5 w-5 text-gray-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">
            {language === 'es' ? 'Configuración General' : 'General Settings'}
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {language === 'es' ? 'Idioma' : 'Language'}
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              title={language === 'es' ? 'Seleccionar idioma' : 'Select language'}
            >
              <option value="es">🇪🇸 Español</option>
              <option value="en">🇺🇸 English</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {language === 'es' ? 'Emisor' : 'Issuer'}
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedIssuer}
              onChange={(e) => setSelectedIssuer(e.target.value as Issuer)}
              title={language === 'es' ? 'Seleccionar emisor' : 'Select issuer'}
            >
              <option value="colombia">🇨🇴 Colombia</option>
              <option value="usa">🇺🇸 USA</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {language === 'es' ? 'Plazo de Pago (días)' : 'Payment Terms (days)'}
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="number"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(Number(e.target.value))}
              min="1"
              title={language === 'es' ? 'Días para vencimiento' : 'Days for due date'}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {language === 'es' ? 'Número de Factura (Automático)' : 'Invoice Number (Automatic)'}
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              type="text"
              value={invoiceNumber || 'Se asignará automáticamente'}
              readOnly
              title="El número de factura se asigna automáticamente"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.transferOption}
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedTransfer}
              onChange={(e) => setSelectedTransfer(e.target.value as TransferOption)}
              title={language === 'es' ? 'Seleccionar opción de transferencia' : 'Select transfer option'}
            >
              <option value="usa">🇺🇸 {transferOptions.usa.name}</option>
              <option value="panama">🇵🇦 {transferOptions.panama.name}</option>
              <option value="colombia">🇨🇴 {transferOptions.colombia.name}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Datos del Cliente */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-gray-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">
              {language === 'es' ? 'Datos del Cliente' : 'Client Details'}
            </h2>
          </div>
          <button
            onClick={() => setManualClientMode(!manualClientMode)}
            className="text-sm text-blue-600 hover:text-blue-700"
            title={manualClientMode 
              ? (language === 'es' ? 'Usar lista de clientes' : 'Use client list')
              : (language === 'es' ? 'Cliente nuevo' : 'New client')
            }
          >
            {manualClientMode 
              ? (language === 'es' ? 'Usar lista de clientes' : 'Use client list')
              : (language === 'es' ? 'Cliente nuevo' : 'New client')
            }
          </button>
        </div>

        {!manualClientMode && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {language === 'es' ? 'Seleccionar Cliente' : 'Select Client'} *
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedClientId}
              onChange={(e) => handleClientSelect(e.target.value)}
              title={language === 'es' ? 'Seleccionar cliente' : 'Select client'}
            >
              <option value="">
                {language === 'es' ? 'Seleccionar cliente existente...' : 'Select existing client...'}
              </option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name} - {client.nit}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {language === 'es' ? 'Nombre' : 'Name'} *
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="text"
              name="clientName"
              value={invoice.clientName}
              onChange={handleInputChange}
              placeholder={language === 'es' ? 'Nombre del cliente' : 'Client name'}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              NIT *
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="text"
              name="clientNIT"
              value={invoice.clientNIT}
              onChange={handleInputChange}
              placeholder="123456789-0"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {language === 'es' ? 'Dirección' : 'Address'} *
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="text"
              name="clientAddress"
              value={invoice.clientAddress}
              onChange={handleInputChange}
              placeholder={language === 'es' ? 'Dirección del cliente' : 'Client address'}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {language === 'es' ? 'Teléfono' : 'Phone'} *
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="text"
              name="clientPhone"
              value={invoice.clientPhone}
              onChange={handleInputChange}
              placeholder="(+57) 300 123 4567"
              required
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {language === 'es' ? 'Ciudad' : 'City'} *
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="text"
              name="clientCity"
              value={invoice.clientCity}
              onChange={handleInputChange}
              placeholder={language === 'es' ? 'Ciudad, País' : 'City, Country'}
              required
            />
          </div>
        </div>
      </div>

      {/* Items de la Factura */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <CreditCard className="h-5 w-5 text-gray-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">
            {language === 'es' ? 'Items de la Factura' : 'Invoice Items'}
          </h2>
        </div>

        {/* Formulario para agregar items */}
        <form onSubmit={handleAddItem} className="mb-6 bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'es' ? 'Descripción' : 'Description'} *
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                type="text"
                name="description"
                value={newItem.description}
                onChange={handleItemChange}
                placeholder={language === 'es' ? 'Descripción del servicio' : 'Service description'}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'es' ? 'Cantidad' : 'Quantity'} *
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                type="number"
                name="quantity"
                value={newItem.quantity}
                onChange={handleItemChange}
                min="1"
                step="0.01"
                title={language === 'es' ? 'Cantidad' : 'Quantity'}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'es' ? 'Precio Unit.' : 'Unit Price'} *
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                type="number"
                name="unitPrice"
                value={newItem.unitPrice}
                onChange={handleItemChange}
                min="0"
                step="0.01"
                title={language === 'es' ? 'Precio unitario' : 'Unit price'}
                required
              />
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {editingIndex !== null ? (
                <>
                  <Edit2 className="h-4 w-4 mr-2" />
                  {language === 'es' ? 'Actualizar' : 'Update'}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {language === 'es' ? 'Agregar' : 'Add'}
                </>
              )}
            </button>
          </div>
        </form>

        {/* Lista de items */}
        {invoice.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'es' ? 'Descripción' : 'Description'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'es' ? 'Cantidad' : 'Quantity'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'es' ? 'Precio Unit.' : 'Unit Price'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'es' ? 'Total' : 'Total'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'es' ? 'Acciones' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoice.items.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEditItem(index)}
                        className="text-blue-600 hover:text-blue-900"
                        title={language === 'es' ? 'Editar item' : 'Edit item'}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(index)}
                        className="text-red-600 hover:text-red-900"
                        title={language === 'es' ? 'Eliminar item' : 'Delete item'}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <CreditCard className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">
              {language === 'es' ? 'No hay items en la factura' : 'No items in invoice'}
            </p>
            <p className="text-sm text-gray-400">
              {language === 'es' ? 'Agrega items usando el formulario de arriba' : 'Add items using the form above'}
            </p>
          </div>
        )}

        {/* Total */}
        {invoice.items.length > 0 && (
          <div className="mt-6 bg-blue-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium text-blue-900">
                {language === 'es' ? 'Total de la Factura:' : 'Invoice Total:'}
              </span>
              <span className="text-2xl font-bold text-blue-900">
                {formatCurrency(invoice.total)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceForm;