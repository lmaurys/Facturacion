import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { InvoiceFromCourse, Client, Course } from '../types';
import { Printer, Download, X } from 'lucide-react';
import { numberToWords } from '../utils/numberToWords';
import { invoiceLabels } from '../constants/invoiceConstants';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatCurrency, formatHours } from '../utils/numberUtils';
import { getApplicableInvoiceFooterText, loadIssuerProfiles, loadTransferOptions } from '../utils/storage';
import defaultLogo from '../assets/MCT.png';

interface InvoiceViewerProps {
  invoice: InvoiceFromCourse;
  client: Client;
  courses: Course[];
  onClose: () => void;
  onEdit?: () => void;
}

const InvoiceViewer: React.FC<InvoiceViewerProps> = ({ invoice, client, courses, onClose, onEdit }) => {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const [issuerProfiles, setIssuerProfiles] = React.useState<Array<{ id: string; name: string; nit: string; address: string; phone: string; city: string; email: string; logoDataUrl?: string; logoUrl?: string }>>([]);
  const [transferOptions, setTransferOptions] = React.useState<Array<{ id: string; bankName: string; bankAddress: string; country: string; swiftCode: string; routingNumber?: string; abaCode?: string; accountOwner: string; accountNumber: { es: string; en: string }; accountOwnerAddress: string }>>([]);
  const [footerText, setFooterText] = React.useState<string>('');

  React.useEffect(() => {
    const load = async () => {
      const [issuers, transfers] = await Promise.all([
        loadIssuerProfiles(),
        loadTransferOptions(),
      ]);
      setIssuerProfiles(issuers);
      setTransferOptions(transfers);
    };
    load();
  }, []);

  const generateDate = (days: number) => {
    const date = new Date(invoice.invoiceDate);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const dueDate = generateDate(invoice.paymentTerms);
  const t = invoiceLabels[invoice.language];

  React.useEffect(() => {
    const loadFooter = async () => {
      const text = await getApplicableInvoiceFooterText(invoice.invoiceDate, invoice.language);
      setFooterText(text);
    };
    loadFooter();
  }, [invoice.invoiceDate, invoice.language]);

  const issuerId = ((invoice as any).issuerId || (invoice as any).issuer) as string | undefined;
  const transferOptionId = ((invoice as any).transferOptionId || (invoice as any).transferOption) as string | undefined;
  const issuer = issuerId ? issuerProfiles.find(i => i.id === issuerId) : undefined;
  const transfer = transferOptionId ? transferOptions.find(o => o.id === transferOptionId) : undefined;
  const issuerLogoSrc = (issuer?.logoDataUrl || issuer?.logoUrl || defaultLogo || '').trim();

  const waitForImages = async (root: HTMLElement): Promise<void> => {
    const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
    await Promise.all(
      imgs.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        });
      })
    );
  };

  const handlePrint = useReactToPrint({
    content: () => invoiceRef.current,
  });

  const handleExportPDF = async () => {
    if (invoiceRef.current) {
      // Asegurar que el logo (u otras imágenes) estén cargadas antes de capturar
      await waitForImages(invoiceRef.current);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 40;

      // Capturar el contenido HTML como una imagen
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        logging: false,
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');

      // Calcular las dimensiones para mantener la proporción
      const imgWidth = pdfWidth - (2 * margin);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Añadir la imagen al PDF
      pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);

      // Ajustar el tamaño del PDF si el contenido es más largo que una página
      if (imgHeight > (pdfHeight - (2 * margin))) {
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, -(pdfHeight - (2 * margin)), imgWidth, imgHeight);
      }

      // Generar el nombre del archivo
      const filename = `Factura_${invoice.invoiceNumber}.pdf`;
      pdf.save(filename);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900">
            Vista Previa - Factura {invoice.invoiceNumber}
          </h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={handlePrint}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded flex items-center"
            >
              <Printer className="mr-2" size={20} />
              Imprimir
            </button>
            <button
              onClick={handleExportPDF}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded flex items-center"
            >
              <Download className="mr-2" size={20} />
              PDF
            </button>
            {onEdit && (
              <button
                onClick={onEdit}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded"
              >
                Editar
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              title="Cerrar"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Invoice Content */}
        <div className="p-6">
          <div ref={invoiceRef}>
            <div className="bg-white rounded p-4 mb-4 text-[11px] font-sans w-full mx-auto">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
                <div className="flex items-center mb-4 sm:mb-0">
                  {issuerLogoSrc ? (
                    <img
                      src={issuerLogoSrc}
                      alt="Logo"
                      crossOrigin="anonymous"
                      className="h-12 w-auto mr-3 object-contain"
                    />
                  ) : null}
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold">{t.invoiceTitle}</h2>
                    <h3 className="text-lg sm:text-xl font-bold">No. {invoice.invoiceNumber}</h3>
                  </div>
                </div>
                <div className="text-right">
                  <p><span className="font-bold">{t.issueDate}:</span> {invoice.invoiceDate}</p>
                  <p><span className="font-bold">{t.dueDate}:</span> {dueDate}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between mb-6">
                <div className="w-full sm:w-1/2 mb-4 sm:mb-0">
                  <h3 className="text-sm font-bold mb-1">{t.issuerData}</h3>
                  <p>{issuer?.name || ''}</p>
                  <p>{issuer?.nit || ''}</p>
                  <p>{t.address}: {issuer?.address || ''}</p>
                  <p>Tel: {issuer?.phone || ''}</p>
                  <p>{issuer?.city || ''}</p>
                  <p>{issuer?.email || ''}</p>
                </div>
                <div className="w-full sm:w-1/2">
                  <h3 className="text-sm font-bold mb-1">{t.clientData}</h3>
                  <p>{client.name}</p>
                  <p>NIT: {client.nit}</p>
                  <p>{t.address}: {client.address}</p>
                  <p>Tel: {client.phone}</p>
                  <p>{client.city}</p>
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
                    {/* Render course items first, visually distinct */}
                    {courses.map((course, index) => (
                      <tr key={`course-${course.id}`} className="border-t border-gray-300 bg-blue-50">
                        <td className="px-2 py-1 font-semibold">{index + 1}</td>
                        <td className="px-2 py-1 font-semibold">{`${course.courseName} (${course.startDate} - ${course.endDate})`}</td>
                        <td className="px-2 py-1 text-right font-semibold">{formatHours(course.hours)}</td>
                        <td className="px-2 py-1 text-right font-semibold">{formatCurrency(course.hourlyRate, course.currency || invoice.currency)}</td>
                        <td className="px-2 py-1 text-right font-semibold">{formatCurrency(course.totalValue, course.currency || invoice.currency)}</td>
                      </tr>
                    ))}
                    {/* Render custom items after courses, visually distinct */}
                    {(invoice.items?.map((item, idx) => (
                      <tr key={`custom-${idx}`} className="border-t border-gray-300 bg-yellow-50">
                        <td className="px-2 py-1">{courses.length + idx + 1}</td>
                        <td className="px-2 py-1">{item.description}</td>
                        <td className="px-2 py-1 text-right">{item.quantity}</td>
                        <td className="px-2 py-1 text-right">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                        <td className="px-2 py-1 text-right">{formatCurrency(item.quantity * item.unitPrice, invoice.currency)}</td>
                      </tr>
                    )) || [])}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row justify-between text-xs">
                <div className="w-full sm:w-1/2 mb-4 sm:mb-0">
                  <p className="font-bold">{t.amountInWords}:</p>
                  <p className="mb-2">{numberToWords(invoice.total, invoice.language)} {invoice.currency}</p>
                  <p className="font-bold">{t.paymentTerms}:</p>
                  <p className="mb-2">{invoice.language === 'es' ? `Pago a Crédito - Cuota No. 001 vence el ${dueDate}` : `Credit Payment - Installment No. 001 due on ${dueDate}`}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-xl mb-2">
                    {t.totalToPay}: {formatCurrency(invoice.total, invoice.currency)}
                  </p>
                  <p className="font-bold">{t.paymentMethod}: {invoice.language === 'es' ? 'Transferencia bancaria' : 'Bank transfer'}</p>
                </div>
              </div>

              <div className="mt-4 w-full">
                <p className="font-bold">{t.observations}:</p>
                <p>{t.transferData}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 mt-2">
                  <div>
                    <p><span className="font-semibold">{t.bankName}:</span> {transfer?.bankName || ''}</p>
                    <p><span className="font-semibold">{t.bankAddress}:</span> {transfer?.bankAddress || ''}</p>
                    <p><span className="font-semibold">{t.country}:</span> {transfer?.country || ''}</p>
                    <p><span className="font-semibold">{t.swiftCode}:</span> {transfer?.swiftCode || ''}</p>
                    {transfer?.routingNumber && (
                      <p><span className="font-semibold">{t.routingNumber}:</span> {transfer.routingNumber}</p>
                    )}
                    {transfer?.abaCode && (
                      <p><span className="font-semibold">{t.abaCode}:</span> {transfer.abaCode}</p>
                    )}
                  </div>
                  <div>
                    <p><span className="font-semibold">{t.accountOwner}:</span> {transfer?.accountOwner || ''}</p>
                    <p><span className="font-semibold">{t.accountNumber}:</span> {transfer?.accountNumber?.[invoice.language] || ''}</p>
                    <p><span className="font-semibold">{t.accountOwnerAddress}:</span> {transfer?.accountOwnerAddress || ''}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-[8px] text-center">
                <p className="text-justify">
                  {footerText}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceViewer; 