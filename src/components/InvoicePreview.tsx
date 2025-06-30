import React from 'react';
import { Invoice, Issuer, issuers, Language } from '../types';
import { numberToWords } from '../utils/numberToWords';
import { invoiceLabels, transferOptions } from '../constants/invoiceConstants';
import { formatHours, formatCurrency } from '../utils/numberUtils';

interface InvoicePreviewProps {
  invoice: Invoice;
  invoiceNumber: string;
  paymentTerms: number;
  selectedIssuer: Issuer;
  language: Language;
}

const InvoicePreview: React.FC<InvoicePreviewProps> = ({ invoice, invoiceNumber, paymentTerms, selectedIssuer, language }) => {
  const generateDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const issueDate = new Date().toISOString().split('T')[0];
  const dueDate = generateDate(paymentTerms);

  const t = invoiceLabels[language];
  const selectedTransfer = transferOptions[invoice.transferOption];

  return (
    <div className="bg-white rounded p-4 mb-4 text-[11px] font-sans w-full mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <div className="flex items-center mb-4 sm:mb-0">
          <img src="https://cmfiles.blob.core.windows.net/logos/mctbadge.png" alt="Company Logo" className="w-16 h-16 sm:w-20 sm:h-20 mr-4" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold">{t.invoiceTitle}</h2>
            <h3 className="text-lg sm:text-xl font-bold">No. {invoiceNumber}</h3>
          </div>
        </div>
        <div className="text-right">
          <p><span className="font-bold">{t.issueDate}:</span> {issueDate}</p>
          <p><span className="font-bold">{t.dueDate}:</span> {dueDate}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between mb-6">
        <div className="w-full sm:w-1/2 mb-4 sm:mb-0">
          <h3 className="text-sm font-bold mb-1">{t.issuerData}</h3>
          <p>{issuers[selectedIssuer].name}</p>
          <p>{issuers[selectedIssuer].nit}</p>
          <p>{t.address}: {issuers[selectedIssuer].address}</p>
          <p>Tel: {issuers[selectedIssuer].phone}</p>
          <p>{issuers[selectedIssuer].city}</p>
          <p>{issuers[selectedIssuer].email}</p>
        </div>
        <div className="w-full sm:w-1/2">
          <h3 className="text-sm font-bold mb-1">{t.clientData}</h3>
          <p>{invoice.clientName}</p>
          <p>NIT: {invoice.clientNIT}</p>
          <p>{t.address}: {invoice.clientAddress}</p>
          <p>Tel: {invoice.clientPhone}</p>
          <p>{invoice.clientCity}</p>
        </div>
      </div>

      <div className="border border-gray-300 rounded-md mb-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-1 text-left">{t.item}</th>
              <th className="px-2 py-1 text-left">{t.description}</th>
              <th className="px-2 py-1 text-right">{t.quantity}</th>
              <th className="px-2 py-1 text-right">{t.unitPrice}</th>
              <th className="px-2 py-1 text-right">{t.total}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index} className="border-t border-gray-300">
                <td className="px-2 py-1">{index + 1}</td>
                <td className="px-2 py-1">{item.description}</td>
                <td className="px-2 py-1 text-right">{formatHours(item.quantity)}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(item.unitPrice)}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(item.quantity * item.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row justify-between text-xs">
        <div className="w-full sm:w-1/2 mb-4 sm:mb-0">
          <p className="font-bold">{t.amountInWords}:</p>
          <p className="mb-2">{numberToWords(invoice.total, language)} {language === 'es' ? 'dólares estadounidenses' : 'US dollars'}</p>
          <p className="font-bold">{t.paymentTerms}:</p>
          <p className="mb-2">{language === 'es' ? `Pago a Crédito - Cuota No. 001 vence el ${dueDate}` : `Credit Payment - Installment No. 001 due on ${dueDate}`}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-xl mb-2">
            {t.totalToPay}: {formatCurrency(invoice.total)}
          </p>
          <p className="font-bold">{t.paymentMethod}: {language === 'es' ? 'Transferencia bancaria' : 'Bank transfer'}</p>
        </div>
      </div>

      <div className="mt-4 w-full">
        <p className="font-bold">{t.observations}:</p>
        <p>{t.transferData}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 mt-2">
          <div>
            <p><span className="font-semibold">{t.bankName}:</span> {selectedTransfer.bankName}</p>
            <p><span className="font-semibold">{t.bankAddress}:</span> {selectedTransfer.bankAddress}</p>
            <p><span className="font-semibold">{t.country}:</span> {selectedTransfer.country}</p>
            <p><span className="font-semibold">{t.swiftCode}:</span> {selectedTransfer.swiftCode}</p>
            {selectedTransfer.routingNumber && (
              <p><span className="font-semibold">{t.routingNumber}:</span> {selectedTransfer.routingNumber}</p>
            )}
            {selectedTransfer.abaCode && (
              <p><span className="font-semibold">{t.abaCode}:</span> {selectedTransfer.abaCode}</p>
            )}
          </div>
          <div>
            <p><span className="font-semibold">{t.accountOwner}:</span> {selectedTransfer.accountOwner}</p>
            <p><span className="font-semibold">{t.accountNumber}:</span> {selectedTransfer.accountNumber[language]}</p>
            <p><span className="font-semibold">{t.accountOwnerAddress}:</span> {selectedTransfer.accountOwnerAddress}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 text-[8px] text-center">
        <p className="text-justify">
          {t.footer}
        </p>
      </div>
    </div>
  );
};

export default InvoicePreview;