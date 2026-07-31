import React from 'react';
import { Invoice, IssuerId, Language } from '../types';
import { numberToWords } from '../utils/numberToWords';
import { invoiceLabels } from '../constants/invoiceConstants';
import { formatHours, formatCurrency } from '../utils/numberUtils';
import { getApplicableInvoiceFooterText, loadIssuerProfiles, loadTenantBranding, loadTransferOptions } from '../utils/storage';
import defaultLogo from '../assets/MCT.png';
import { readLogoSource } from '../utils/tenantBranding';

interface InvoicePreviewProps {
  invoice: Invoice;
  invoiceNumber: string;
  paymentTerms: number;
  selectedIssuerId: IssuerId;
  language: Language;
}

const InvoicePreview: React.FC<InvoicePreviewProps> = ({ invoice, invoiceNumber, paymentTerms, selectedIssuerId, language }) => {
  const [issuerProfiles, setIssuerProfiles] = React.useState<Array<{ id: string; name: string; nit: string; address: string; phone: string; city: string; email: string; logoDataUrl?: string; logoUrl?: string }>>([]);
  const [transferOptions, setTransferOptions] = React.useState<Array<{ id: string; bankName: string; bankAddress: string; country: string; swiftCode: string; routingNumber?: string; abaCode?: string; accountOwner: string; accountNumber: { es: string; en: string }; accountOwnerAddress: string }>>([]);
  const [footerText, setFooterText] = React.useState<string>('');
  const [tenantLogoSrc, setTenantLogoSrc] = React.useState<string>('');

  React.useEffect(() => {
    const load = async () => {
      const [issuers, transfers, branding] = await Promise.all([
        loadIssuerProfiles(),
        loadTransferOptions(),
        loadTenantBranding(),
      ]);
      setIssuerProfiles(issuers);
      setTransferOptions(transfers);
      setTenantLogoSrc(readLogoSource(branding));
    };
    load();
  }, []);
  const generateDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const issueDate = new Date().toISOString().split('T')[0];
  const dueDate = generateDate(paymentTerms);

  React.useEffect(() => {
    const loadFooter = async () => {
      const text = await getApplicableInvoiceFooterText(issueDate, language);
      setFooterText(text);
    };
    loadFooter();
  }, [issueDate, language]);

  const t = invoiceLabels[language];
  const issuer = issuerProfiles.find(i => i.id === selectedIssuerId);
  const selectedTransfer = transferOptions.find(t => t.id === invoice.transferOptionId);
  const invoiceLogoSrc = (tenantLogoSrc || issuer?.logoDataUrl || issuer?.logoUrl || defaultLogo || '').trim();

  return (
    <div className="mx-auto mb-4 w-full rounded bg-white p-5 font-sans text-[11px] leading-relaxed text-slate-900 sm:p-6">
      <div className="mb-7 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-8">
        <div className="flex min-w-0 items-center">
          {invoiceLogoSrc ? (
            <img
              src={invoiceLogoSrc}
              alt="Logo"
              crossOrigin="anonymous"
              className="h-12 w-auto mr-3 object-contain"
            />
          ) : null}
          <div className="min-w-0">
            <h2 className="text-xl font-bold leading-tight">{t.invoiceTitle}</h2>
            <h3 className="mt-1 text-xl font-bold leading-tight">No. {invoiceNumber || '—'}</h3>
          </div>
        </div>
        <div className="min-w-[190px] text-right">
          <p><span className="font-bold">{t.issueDate}:</span> {issueDate}</p>
          <p><span className="font-bold">{t.dueDate}:</span> {dueDate}</p>
        </div>
      </div>

      <div className="mb-7 grid grid-cols-2 gap-10">
        <div className="min-w-0 break-words">
          <h3 className="text-sm font-bold mb-1">{t.issuerData}</h3>
          <p>{issuer?.name || ''}</p>
          <p>{issuer?.nit || ''}</p>
          <p>{t.address}: {issuer?.address || ''}</p>
          <p>Tel: {issuer?.phone || ''}</p>
          <p>{issuer?.city || ''}</p>
          <p>{issuer?.email || ''}</p>
        </div>
        <div className="min-w-0 break-words">
          <h3 className="text-sm font-bold mb-1">{t.clientData}</h3>
          <p>{invoice.clientName}</p>
          <p>NIT: {invoice.clientNIT}</p>
          <p>{t.address}: {invoice.clientAddress}</p>
          <p>Tel: {invoice.clientPhone}</p>
          <p>{invoice.clientCity}</p>
        </div>
      </div>

      <div className="mb-5 overflow-hidden rounded-md border border-gray-300">
        <table className="w-full table-fixed text-xs">
          <colgroup>
            <col className="w-[7%]" />
            <col className="w-[40%]" />
            <col className="w-[13%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-1 text-left">{t.item}</th>
              <th className="px-2 py-1 text-left">{t.description}</th>
              <th className="px-2 py-1 text-right whitespace-nowrap">{t.quantity}</th>
              <th className="px-2 py-1 text-right whitespace-nowrap">{t.unitPrice}</th>
              <th className="px-2 py-1 text-right whitespace-nowrap">{t.total}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index} className="border-t border-gray-300">
                <td className="px-2 py-1">{index + 1}</td>
                <td className="break-words px-2 py-1.5">{item.description}</td>
                <td className="px-2 py-1.5 text-right">{formatHours(item.quantity)}</td>
                <td className="px-2 py-1.5 text-right">{formatCurrency(item.unitPrice, invoice.currency, 'es-ES', 3)}</td>
                <td className="px-2 py-1.5 text-right">{formatCurrency(item.quantity * item.unitPrice, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-8 text-xs">
        <div className="min-w-0">
          <p className="font-bold">{t.amountInWords}:</p>
          <p className="mb-2">{numberToWords(invoice.total, language)} {invoice.currency}</p>
          <p className="font-bold">{t.paymentTerms}:</p>
          <p className="mb-2">{language === 'es' ? `Pago a Crédito - Cuota No. 001 vence el ${dueDate}` : `Credit Payment - Installment No. 001 due on ${dueDate}`}</p>
        </div>
        <div className="min-w-[250px] text-right">
          <p className="mb-2 whitespace-nowrap text-xl font-bold">
            {t.totalToPay}: {formatCurrency(invoice.total, invoice.currency)}
          </p>
          <p className="font-bold">{t.paymentMethod}: {language === 'es' ? 'Transferencia bancaria' : 'Bank transfer'}</p>
        </div>
      </div>

      <div className="mt-4 w-full">
        <p className="font-bold">{t.observations}:</p>
        <p>{t.transferData}</p>
        <div className="mt-2 grid grid-cols-2 gap-x-8">
          <div className="min-w-0 break-words">
            <p><span className="font-semibold">{t.bankName}:</span> {selectedTransfer?.bankName || ''}</p>
            <p><span className="font-semibold">{t.bankAddress}:</span> {selectedTransfer?.bankAddress || ''}</p>
            <p><span className="font-semibold">{t.country}:</span> {selectedTransfer?.country || ''}</p>
            <p><span className="font-semibold">{t.swiftCode}:</span> {selectedTransfer?.swiftCode || ''}</p>
            {selectedTransfer?.routingNumber && (
              <p><span className="font-semibold">{t.routingNumber}:</span> {selectedTransfer.routingNumber}</p>
            )}
            {selectedTransfer?.abaCode && (
              <p><span className="font-semibold">{t.abaCode}:</span> {selectedTransfer.abaCode}</p>
            )}
          </div>
          <div className="min-w-0 break-words">
            <p><span className="font-semibold">{t.accountOwner}:</span> {selectedTransfer?.accountOwner || ''}</p>
            <p><span className="font-semibold">{t.accountNumber}:</span> {selectedTransfer?.accountNumber?.[language] || ''}</p>
            <p><span className="font-semibold">{t.accountOwnerAddress}:</span> {selectedTransfer?.accountOwnerAddress || ''}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 text-[8px] text-center">
        <p className="text-justify">
                  {footerText}
        </p>
      </div>
    </div>
  );
};

export default InvoicePreview;
