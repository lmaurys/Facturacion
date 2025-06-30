import React, { useState } from 'react';
import { Invoice, Item, Issuer, Language, issuers, TransferOption } from '../types';
import { transferOptions, invoiceLabels } from '../constants/invoiceConstants';

interface InvoiceFormProps {
  invoice: Invoice;
  updateInvoice: (invoice: Partial<Invoice>) => void;
  addItem: (item: Item) => void;
  editItem: (index: number, item: Item) => void;
  deleteItem: (index: number) => void;
  selectedIssuer: Issuer;
  setSelectedIssuer: (issuer: Issuer) => void;
  invoiceNumber: string;
  setInvoiceNumber: (number: string) => void;
  paymentTerms: number;
  setPaymentTerms: (terms: number) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  selectedTransfer: TransferOption;
  setSelectedTransfer: (transfer: TransferOption) => void;
  onGenerateFromCourses?: () => void;
  onClearInvoice?: () => void;
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
  setInvoiceNumber,
  paymentTerms,
  setPaymentTerms,
  language,
  setLanguage,
  selectedTransfer,
  setSelectedTransfer,
  onGenerateFromCourses,
  onClearInvoice,
}) => {
  const [newItem, setNewItem] = useState<Item>({
    description: '',
    quantity: 0,
    unitPrice: 0,
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    updateInvoice({ [name]: value });
  };

  const handleItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewItem((prev) => ({ ...prev, [name]: name === 'description' ? value : Number(value) }));
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingIndex !== null) {
      editItem(editingIndex, newItem);
      setEditingIndex(null);
    } else {
      addItem(newItem);
    }
    setNewItem({ description: '', quantity: 0, unitPrice: 0 });
  };

  const handleEditItem = (index: number) => {
    setNewItem(invoice.items[index]);
    setEditingIndex(index);
  };

  const handleDeleteItem = (index: number) => {
    deleteItem(index);
  };

  const t = invoiceLabels[language];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="language">
            {language === 'es' ? 'Idioma' : 'Language'}
          </label>
          <select
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="issuer">
            {language === 'es' ? 'Emisor' : 'Issuer'}
          </label>
          <select
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            id="issuer"
            value={selectedIssuer}
            onChange={(e) => setSelectedIssuer(e.target.value as Issuer)}
          >
            <option value="colombia">Colombia</option>
            <option value="usa">USA</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="invoiceNumber">
            {language === 'es' ? 'Número de Factura (Automático)' : 'Invoice Number (Automatic)'}
          </label>
          <input
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50"
            id="invoiceNumber"
            type="text"
            value={invoiceNumber || 'Se asignará automáticamente'}
            readOnly
            title="El número de factura se asigna automáticamente"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="paymentTerms">
            {language === 'es' ? 'Plazo de Pago (días)' : 'Payment Terms (days)'}
          </label>
          <input
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            id="paymentTerms"
            type="number"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="transferOption">
            {t.transferOption}
          </label>
          <select
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            id="transferOption"
            value={selectedTransfer}
            onChange={(e) => setSelectedTransfer(e.target.value as TransferOption)}
          >
            <option value="usa">{transferOptions.usa.name}</option>
            <option value="panama">{transferOptions.panama.name}</option>
            <option value="colombia">{transferOptions.colombia.name}</option>
          </select>
        </div>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">{language === 'es' ? 'Datos del Cliente' : 'Client Details'}</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="clientName">
            {language === 'es' ? 'Nombre' : 'Name'}
          </label>
          <input
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            id="clientName"
            type="text"
            name="clientName"
            value={invoice.clientName}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="clientNIT">
            NIT
          </label>
          <input
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            id="clientNIT"
            type="text"
            name="clientNIT"
            value={invoice.clientNIT}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="clientAddress">
            {language === 'es' ? 'Dirección' : 'Address'}
          </label>
          <input
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            id="clientAddress"
            type="text"
            name="clientAddress"
            value={invoice.clientAddress}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="clientPhone">
            {language === 'es' ? 'Teléfono' : 'Phone'}
          </label>
          <input
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            id="clientPhone"
            type="text"
            name="clientPhone"
            value={invoice.clientPhone}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="clientCity">
            {language === 'es' ? 'Ciudad' : 'City'}
          </label>
          <input
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            id="clientCity"
            type="text"
            name="clientCity"
            value={invoice.clientCity}
            onChange={handleInputChange}
          />
        </div>
      </div>

      <div className="flex justify-between items-center mt-8 mb-4">
        <h2 className="text-xl font-semibold">{language === 'es' ? 'Agregar Item' : 'Add Item'}</h2>
        <div className="flex space-x-2">
          {onClearInvoice && (
            <button
              onClick={onClearInvoice}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="button"
            >
              {language === 'es' ? 'Limpiar Factura' : 'Clear Invoice'}
            </button>
          )}
          {onGenerateFromCourses && (
            <button
              onClick={onGenerateFromCourses}
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="button"
            >
              {language === 'es' ? 'Generar desde Cursos' : 'Generate from Courses'}
            </button>
          )}
        </div>
      </div>
      <form onSubmit={handleAddItem} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="description">
            {language === 'es' ? 'Descripción' : 'Description'}
          </label>
          <input
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            id="description"
            type="text"
            name="description"
            value={newItem.description}
            onChange={handleItemChange}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="quantity">
            {language === 'es' ? 'Cantidad' : 'Quantity'}
          </label>
          <input
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            id="quantity"
            type="number"
            name="quantity"
            value={newItem.quantity}
            onChange={handleItemChange}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="unitPrice">
            {language === 'es' ? 'Precio Unitario (USD)' : 'Unit Price (USD)'}
          </label>
          <input
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            id="unitPrice"
            type="number"
            name="unitPrice"
            value={newItem.unitPrice}
            onChange={handleItemChange}
            required
          />
        </div>
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          type="submit"
        >
          {editingIndex !== null
            ? (language === 'es' ? 'Actualizar Item' : 'Update Item')
            : (language === 'es' ? 'Agregar Item' : 'Add Item')}
        </button>
      </form>

      <h2 className="text-xl font-semibold mt-8 mb-4">{language === 'es' ? 'Items' : 'Items'}</h2>
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
                {language === 'es' ? 'Precio Unitario (USD)' : 'Unit Price (USD)'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {language === 'es' ? 'Acciones' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoice.items.map((item, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap">{item.description}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.quantity}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.unitPrice}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleEditItem(index)}
                    className="text-blue-500 hover:text-blue-700 mr-2"
                  >
                    {language === 'es' ? 'Editar' : 'Edit'}
                  </button>
                  <button
                    onClick={() => handleDeleteItem(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    {language === 'es' ? 'Eliminar' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvoiceForm;