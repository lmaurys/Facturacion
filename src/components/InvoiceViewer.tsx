import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { InvoiceFromCourse, Client, Course, Issuer, Language, issuers } from '../types';
import { Printer, Download, X } from 'lucide-react';
import { numberToWords } from '../utils/numberToWords';
import { invoiceLabels, invoiceFixedValues } from '../constants/invoiceConstants';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface InvoiceViewerProps {
  invoice: InvoiceFromCourse;
  client: Client;
  courses: Course[];
  onClose: () => void;
  onEdit?: () => void;
}

const InvoiceViewer: React.FC<InvoiceViewerProps> = ({ invoice, client, courses, onClose, onEdit }) => {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const generateDate = (days: number) => {
    const date = new Date(invoice.invoiceDate);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const dueDate = generateDate(invoice.paymentTerms);
  const t = invoiceLabels[invoice.language];

  const handlePrint = useReactToPrint({
    content: () => invoiceRef.current,
  });

  const handleExportPDF = async () => {
    if (invoiceRef.current) {
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
                  <img src="https://cmfiles.blob.core.windows.net/logos/mctbadge.png" alt="Company Logo" className="w-16 h-16 sm:w-20 sm:h-20 mr-4" />
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
                  <p>{issuers[invoice.issuer].name}</p>
                  <p>{issuers[invoice.issuer].nit}</p>
                  <p>{t.address}: {issuers[invoice.issuer].address}</p>
                  <p>Tel: {issuers[invoice.issuer].phone}</p>
                  <p>{issuers[invoice.issuer].city}</p>
                  <p>{issuers[invoice.issuer].email}</p>
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
                    {courses.map((course, index) => (
                      <tr key={course.id} className="border-t border-gray-300">
                        <td className="px-2 py-1">{index + 1}</td>
                        <td className="px-2 py-1">{`${course.courseName} (${course.startDate} - ${course.endDate})`}</td>
                        <td className="px-2 py-1 text-right">{course.hours}</td>
                        <td className="px-2 py-1 text-right">{formatCurrency(course.hourlyRate)}</td>
                        <td className="px-2 py-1 text-right">{formatCurrency(course.totalValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row justify-between text-xs">
                <div className="w-full sm:w-1/2 mb-4 sm:mb-0">
                  <p className="font-bold">{t.amountInWords}:</p>
                  <p className="mb-2">{numberToWords(invoice.total, invoice.language)} {invoice.language === 'es' ? 'dólares estadounidenses' : 'US dollars'}</p>
                  <p className="font-bold">{t.paymentTerms}:</p>
                  <p className="mb-2">{invoice.language === 'es' ? `Pago a Crédito - Cuota No. 001 vence el ${dueDate}` : `Credit Payment - Installment No. 001 due on ${dueDate}`}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-xl mb-2">
                    {t.totalToPay}: {formatCurrency(invoice.total)}
                  </p>
                  <p className="font-bold">{t.paymentMethod}: {invoice.language === 'es' ? 'Transferencia bancaria' : 'Bank transfer'}</p>
                </div>
              </div>

              <div className="mt-4 w-full">
                <p className="font-bold">{t.observations}:</p>
                <p>{t.transferData}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 mt-2">
                  <div>
                    <p><span className="font-semibold">{t.bankName}:</span> {invoiceFixedValues.bankName}</p>
                    <p><span className="font-semibold">{t.bankAddress}:</span> {invoiceFixedValues.bankAddress}</p>
                    <p><span className="font-semibold">{t.country}:</span> {invoiceFixedValues.country}</p>
                    <p><span className="font-semibold">{t.swiftCode}:</span> {invoiceFixedValues.swiftCode}</p>
                    <p><span className="font-semibold">{t.routingNumber}:</span> {invoiceFixedValues.routingNumber}</p>
                  </div>
                  <div>
                    <p><span className="font-semibold">{t.accountOwner}:</span> {invoiceFixedValues.accountOwner}</p>
                    <p><span className="font-semibold">{t.ibanNumber}:</span> {invoiceFixedValues.ibanNumber}</p>
                    <p><span className="font-semibold">{t.accountNumber}:</span> {invoiceFixedValues.accountNumber[invoice.language]}</p>
                    <p><span className="font-semibold">{t.accountOwnerAddress}:</span> {invoiceFixedValues.address}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-[8px] text-center">
                <p className="text-justify">
                  {t.footer}
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