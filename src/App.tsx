import React, { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, Download, FileText, GraduationCap, Building, Database, BarChart3 } from 'lucide-react';
import InvoiceForm from './components/InvoiceForm';
import InvoicePreview from './components/InvoicePreview';
import CourseManagement from './components/CourseManagement';
import ClientManagement from './components/ClientManagement';
import InvoiceManagement from './components/InvoiceManagement';
import DataManagement from './components/DataManagement';
import InvoiceAnalytics from './components/InvoiceAnalytics';
import InvoiceFromCourses from './components/InvoiceFromCourses';
import { Invoice, Item, Issuer, Language, Client, InvoiceFromCourse, issuers } from './types';
import { addInvoice, importAllData, loadClients } from './utils/storage';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type AppMode = 'invoicing' | 'courses' | 'clients' | 'invoices' | 'analytics' | 'data';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>('invoicing');
  const [showInvoiceFromCourses, setShowInvoiceFromCourses] = useState(false);
  const [hasTriedAutoLoad, setHasTriedAutoLoad] = useState(false);
  const [invoice, setInvoice] = useState<Invoice>({
    clientName: 'Fast Lane Consulting Services Latam',
    clientNIT: '155596520-2-2015',
    clientAddress: 'Punta Pacíf, Cll Isaac Hanono Missri. Ed Oceanía Business',
    clientPhone: '(51) 991347214',
    clientCity: 'Ciudad de Panamá, Panamá',
    items: [],
    total: 0,
  });
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentTerms, setPaymentTerms] = useState(30);
  const [selectedIssuer, setSelectedIssuer] = useState<Issuer>('colombia');
  const [language, setLanguage] = useState<Language>('es');

  const invoiceRef = useRef<HTMLDivElement>(null);

  // Intentar cargar datos predeterminados al inicio
  React.useEffect(() => {
    const tryAutoLoadData = async () => {
      if (hasTriedAutoLoad) return;
      
      try {
        // Verificar si ya hay clientes cargados
        const existingClients = await loadClients();
        if (existingClients.length > 0) {
          setHasTriedAutoLoad(true);
          return;
        }

        // Intentar cargar datos predeterminados
        const response = await fetch('/data/sistema_datos.json');
        if (response.ok) {
          const jsonData = await response.text();
          const success = await importAllData(jsonData);
          if (success) {
            console.log('Datos predeterminados cargados automáticamente');
          }
        }
      } catch (error) {
        console.log('No se pudieron cargar datos predeterminados:', error);
      } finally {
        setHasTriedAutoLoad(true);
      }
    };

    tryAutoLoadData();
  }, [hasTriedAutoLoad]);

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
      const filename = `Factura${invoiceNumber}.pdf`;
      pdf.save(filename);
    }
  };

  const updateInvoice = (updatedInvoice: Partial<Invoice>) => {
    setInvoice((prev) => ({ ...prev, ...updatedInvoice }));
  };

  const addItem = (item: Item) => {
    setInvoice((prev) => ({
      ...prev,
      items: [...prev.items, item],
      total: prev.total + item.quantity * item.unitPrice,
    }));
  };

  const editItem = (index: number, item: Item) => {
    setInvoice((prev) => {
      const newItems = [...prev.items];
      newItems[index] = item;
      const newTotal = newItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      return { ...prev, items: newItems, total: newTotal };
    });
  };

  const deleteItem = (index: number) => {
    setInvoice((prev) => {
      const newItems = prev.items.filter((_, i) => i !== index);
      const newTotal = newItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      return { ...prev, items: newItems, total: newTotal };
    });
  };

  const clearInvoice = () => {
    if (window.confirm('¿Estás seguro de que quieres limpiar toda la factura?')) {
      setInvoice({
        clientName: '',
        clientNIT: '',
        clientAddress: '',
        clientPhone: '',
        clientCity: '',
        items: [],
        total: 0,
      });
      setInvoiceNumber('');
    }
  };

  const handleGenerateInvoiceFromCourses = async (items: Item[], clientData: Client, courseIds: string[], invoiceNumber: string) => {
    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    
    // Crear y guardar la factura en la base de datos
    const invoiceData: Omit<InvoiceFromCourse, 'id'> = {
      clientId: clientData.id,
      courseIds: courseIds,
      invoiceNumber: invoiceNumber,
      invoiceDate: new Date().toISOString().split('T')[0],
      issuer: selectedIssuer,
      language: language,
      paymentTerms: paymentTerms,
      subtotal: total,
      total: total,
      status: 'draft',
      observations: `Factura generada desde cursos: ${items.map(item => item.description).join(', ')}`
    };

    try {
      const savedInvoice = await addInvoice(invoiceData);
      if (savedInvoice) {
        console.log('Factura guardada exitosamente:', savedInvoice);
      }
    } catch (error) {
      console.error('Error guardando factura:', error);
    }
    
    // Actualizar el formulario de facturación tradicional
    setInvoice({
      clientName: clientData.name,
      clientNIT: clientData.nit,
      clientAddress: clientData.address,
      clientPhone: clientData.phone,
      clientCity: clientData.city,
      items,
      total
    });
    
    setShowInvoiceFromCourses(false);
    setCurrentMode('invoicing');
  };

  const renderContent = () => {
    if (currentMode === 'courses') {
      return <CourseManagement />;
    }
    
    if (currentMode === 'clients') {
      return <ClientManagement />;
    }

    if (currentMode === 'invoices') {
      return <InvoiceManagement />;
    }

    if (currentMode === 'analytics') {
      return <InvoiceAnalytics />;
    }

    if (currentMode === 'data') {
      return <DataManagement onDataImported={() => console.log('Data imported')} />;
    }

    return (
      <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white shadow-md rounded-lg p-6">
              <InvoiceForm
                invoice={invoice}
                updateInvoice={updateInvoice}
                addItem={addItem}
                editItem={editItem}
                deleteItem={deleteItem}
                selectedIssuer={selectedIssuer}
                setSelectedIssuer={setSelectedIssuer}
                invoiceNumber={invoiceNumber}
                setInvoiceNumber={setInvoiceNumber}
                paymentTerms={paymentTerms}
                setPaymentTerms={setPaymentTerms}
                language={language}
                setLanguage={setLanguage}
                onGenerateFromCourses={() => setShowInvoiceFromCourses(true)}
                onClearInvoice={clearInvoice}
              />
            </div>
            <div className="bg-white shadow-md rounded-lg p-6">
              <div ref={invoiceRef}>
                <InvoicePreview
                  invoice={invoice}
                  invoiceNumber={invoiceNumber}
                  paymentTerms={paymentTerms}
                  selectedIssuer={selectedIssuer}
                  language={language}
                />
              </div>
              <div className="mt-4 flex justify-end space-x-4">
                <button
                  onClick={handlePrint}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded flex items-center"
                >
                  <Printer className="mr-2" size={20} />
                  {language === 'es' ? 'Imprimir' : 'Print'}
                </button>
                <button
                  onClick={handleExportPDF}
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded flex items-center"
                >
                  <Download className="mr-2" size={20} />
                  {language === 'es' ? 'PDF' : 'PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">
                Sistema de Gestión Profesional
              </h1>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => setCurrentMode('clients')}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentMode === 'clients'
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Building className="mr-2" size={18} />
                Clientes
              </button>
              <button
                onClick={() => setCurrentMode('courses')}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentMode === 'courses'
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <GraduationCap className="mr-2" size={18} />
                Cursos
              </button>
              <button
                onClick={() => setCurrentMode('invoicing')}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentMode === 'invoicing'
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <FileText className="mr-2" size={18} />
                Facturación
              </button>
              <button
                onClick={() => setCurrentMode('invoices')}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentMode === 'invoices'
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <FileText className="mr-2" size={18} />
                Facturas
              </button>
              <button
                onClick={() => setCurrentMode('analytics')}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentMode === 'analytics'
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <BarChart3 className="mr-2" size={18} />
                Análisis
              </button>
              <button
                onClick={() => setCurrentMode('data')}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentMode === 'data'
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Database className="mr-2" size={18} />
                Datos
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Title */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {currentMode === 'clients'
              ? 'Gestión de Clientes'
              : currentMode === 'courses'
              ? 'Gestión de Cursos'
              : currentMode === 'invoicing' 
              ? (language === 'es' ? 'Facturación Profesional' : 'Professional Invoicing')
              : currentMode === 'invoices'
              ? 'Gestión de Facturas'
              : currentMode === 'analytics'
              ? 'Análisis de Facturación'
              : 'Gestión Central de Datos'
            }
          </h2>
        </div>
      </div>

      {/* Main Content */}
      {renderContent()}

      {/* Modal para generar factura desde cursos */}
      {showInvoiceFromCourses && (
        <InvoiceFromCourses
          onGenerateInvoice={handleGenerateInvoiceFromCourses}
          onClose={() => setShowInvoiceFromCourses(false)}
        />
      )}
    </div>
  );
};

export default App;