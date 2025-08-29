import React, { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, Download, FileText, GraduationCap, Building, Database, BarChart3, Menu, X, ArrowUp } from 'lucide-react';
import InvoiceForm from './components/InvoiceForm';
import InvoicePreview from './components/InvoicePreview';
import CourseManagement from './components/CourseManagement';
import ClientManagement from './components/ClientManagement';
import InvoiceManagement from './components/InvoiceManagement';
import DataManagement from './components/DataManagement';
import InvoiceAnalytics from './components/InvoiceAnalytics';
import InvoiceFromCourses from './components/InvoiceFromCourses';
import { Invoice, Item, Issuer, Language, TransferOption, Client, InvoiceFromCourse } from './types';
import { addInvoice, loadClients, initializeAutoSync, initializeFromAzure } from './utils/storage';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type AppMode = 'invoicing' | 'courses' | 'clients' | 'invoices' | 'analytics' | 'data';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>('clients');
  const [showInvoiceFromCourses, setShowInvoiceFromCourses] = useState(false);
  const [hasTriedAutoLoad, setHasTriedAutoLoad] = useState(false);
  const [invoice, setInvoice] = useState<Invoice>({
    clientName: '',
    clientNIT: '',
    clientAddress: '',
    clientPhone: '',
    clientCity: '',
    items: [],
    total: 0,
    transferOption: 'usa',
  });
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentTerms, setPaymentTerms] = useState(30);
  const [selectedIssuer, setSelectedIssuer] = useState<Issuer>('colombia');
  const [language, setLanguage] = useState<Language>('es');
  const [selectedTransfer, setSelectedTransfer] = useState<TransferOption>('usa');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const visibleInvoiceRef = useRef<HTMLDivElement>(null);
  const hiddenInvoiceRef = useRef<HTMLDivElement>(null);

  // Cargar datos automáticamente desde Azure al inicio
  React.useEffect(() => {
    const initializeApp = async () => {
      if (hasTriedAutoLoad) return;
      
      try {
        console.log('🚀 Inicializando aplicación con Azure Blob Storage...');
        
        // Intentar cargar datos desde Azure
        const success = await initializeFromAzure();
        
        if (success) {
          console.log('✅ Aplicación inicializada desde Azure exitosamente');
        } else {
          console.log('⚠️ Error inicializando desde Azure, pero la app funcionará normalmente');
        }
        
        setHasTriedAutoLoad(true);
      } catch (error) {
        console.error('❌ Error durante inicialización:', error);
        setHasTriedAutoLoad(true);
      }
    };

    // Permitir uso inmediato de la app mientras se cargan los datos
  // App usable mientras se cargan los datos
    initializeApp();
  }, [hasTriedAutoLoad]);

  // Inicializar sincronización automática con Azure
  React.useEffect(() => {
    // Esperar un poco para que la inicialización termine
    const timer = setTimeout(() => {
      console.log('🔄 Iniciando sincronización automática cada 15 minutos...');
      initializeAutoSync(15);
    }, 3000);
    
    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Detectar scroll para sombrear el header sticky
  React.useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHasScrolled(y > 2);
      setShowScrollTop(y > 300);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Sincronizar la opción de transferencia con el invoice
  React.useEffect(() => {
    setInvoice((prev) => ({ ...prev, transferOption: selectedTransfer }));
  }, [selectedTransfer]);

  const handlePrint = useReactToPrint({
    content: () => (window.innerWidth < 768 ? hiddenInvoiceRef.current : visibleInvoiceRef.current),
  });

  const handleExportPDF = async () => {
    const node = window.innerWidth < 768 ? hiddenInvoiceRef.current : visibleInvoiceRef.current;
    if (!node) return;

    // Documento tamaño Carta con márgenes mínimos (0.25")
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 18; // ~0.25 inch en puntos

    // Capturar el contenido HTML como una imagen
    const canvas = await html2canvas(node, { scale: 2, logging: false, useCORS: true });
    const imgData = canvas.toDataURL('image/png');

    // Escalado para encajar dentro de los márgenes sin distorsión
    const maxWidth = pageWidth - 2 * margin;
    const maxHeight = pageHeight - 2 * margin;
    const widthRatio = maxWidth / canvas.width;
    const heightRatio = maxHeight / canvas.height;
    const ratio = Math.min(widthRatio, heightRatio);
    const renderWidth = canvas.width * ratio;
    const renderHeight = canvas.height * ratio;

    pdf.addImage(imgData, 'PNG', margin, margin, renderWidth, renderHeight);

    const filename = `Factura${invoiceNumber}.pdf`;
    pdf.save(filename);
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
        transferOption: selectedTransfer,
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
      transferOption: selectedTransfer,
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
      total,
      transferOption: selectedTransfer,
    });
    
    setShowInvoiceFromCourses(false);
    setCurrentMode('invoicing');
  };

  // Nueva función para guardar facturas tradicionales
  const handleSaveInvoice = async () => {
    if (!invoice.clientName || invoice.items.length === 0) {
      alert('Por favor completa todos los campos obligatorios: cliente y al menos un item');
      return;
    }

    try {
      // Buscar el cliente por nombre (si existe) o crear uno temporal
      const clients = await loadClients();
      let clientId = '';
      
      const existingClient = clients.find(c => c.name === invoice.clientName);
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        // El cliente no existe, crear uno temporal
        clientId = `temp_client_${Date.now()}`;
      }

      // Generar número de factura automáticamente si está vacío
      let finalInvoiceNumber = invoiceNumber;
      if (!finalInvoiceNumber) {
        const { getNextInvoiceNumber } = await import('./utils/storage');
        finalInvoiceNumber = await getNextInvoiceNumber();
        setInvoiceNumber(finalInvoiceNumber);
      }

      const invoiceData: Omit<InvoiceFromCourse, 'id'> = {
        clientId: clientId,
        courseIds: [], // No hay cursos asociados para facturas tradicionales
        invoiceNumber: finalInvoiceNumber,
        invoiceDate: new Date().toISOString().split('T')[0],
        issuer: selectedIssuer,
        language: language,
        paymentTerms: paymentTerms,
        subtotal: invoice.total,
        total: invoice.total,
        status: 'draft',
        transferOption: selectedTransfer,
        observations: `Factura tradicional - Cliente: ${invoice.clientName}, NIT: ${invoice.clientNIT}`
      };

      const savedInvoice = await addInvoice(invoiceData);
      if (savedInvoice) {
        alert(`¡Factura guardada exitosamente!\nNúmero de factura: ${finalInvoiceNumber}`);
        console.log('Factura guardada:', savedInvoice);
      } else {
        alert('Error al guardar la factura. Intenta nuevamente.');
      }
    } catch (error) {
      console.error('Error guardando factura:', error);
      alert('Error al guardar la factura. Intenta nuevamente.');
    }
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
  return <DataManagement />;
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
                paymentTerms={paymentTerms}
                setPaymentTerms={setPaymentTerms}
                language={language}
                setLanguage={setLanguage}
                selectedTransfer={selectedTransfer}
                setSelectedTransfer={setSelectedTransfer}
                onGenerateFromCourses={() => setShowInvoiceFromCourses(true)}
                onClearInvoice={clearInvoice}
                onSaveInvoice={handleSaveInvoice}
              />
            </div>

            <div className="bg-white shadow-md rounded-lg p-6 hidden lg:block">
              <div ref={visibleInvoiceRef}>
                <InvoicePreview
                  invoice={invoice}
                  invoiceNumber={invoiceNumber}
                  selectedIssuer={selectedIssuer}
                  language={language}
                  paymentTerms={paymentTerms}
                />
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-3">
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
            {/* Contenedor offscreen para PDF/impresión en pantallas pequeñas */}
            <div className="block lg:hidden">
              <div ref={hiddenInvoiceRef} className="fixed -left-[10000px] -top-[10000px] w-[794px] bg-white p-4">
                <InvoicePreview
                  invoice={invoice}
                  invoiceNumber={invoiceNumber}
                  selectedIssuer={selectedIssuer}
                  language={language}
                  paymentTerms={paymentTerms}
                />
              </div>
              <div className="bg-white shadow-md rounded-lg p-6">
                <p className="text-sm text-gray-700">
                  La previsualización se oculta en pantallas pequeñas para preservar el formato del PDF. Usa los botones de Imprimir o PDF para generar el documento con el diseño correcto.
                </p>
                <div className="mt-4 flex flex-wrap justify-end gap-3">
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
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation Header */}
      <nav className={`sticky top-0 z-50 bg-white border-b border-gray-200 ${hasScrolled ? 'shadow-md' : 'shadow-sm'}`}
        onScrollCapture={() => {}}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">
                Sistema de Gestión Profesional
              </h1>
            </div>
            {/* Botón menú móvil */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(prev => !prev)}
                aria-label="Abrir menú"
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
            {/* Menú de escritorio */}
            <div className="hidden md:flex space-x-2 lg:space-x-4">
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
        {/* Menú móvil desplegable */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {([
                { key: 'clients', label: 'Clientes', icon: <Building className="mr-2" size={16} /> },
                { key: 'courses', label: 'Cursos', icon: <GraduationCap className="mr-2" size={16} /> },
                { key: 'invoicing', label: 'Facturación', icon: <FileText className="mr-2" size={16} /> },
                { key: 'invoices', label: 'Facturas', icon: <FileText className="mr-2" size={16} /> },
                { key: 'analytics', label: 'Análisis', icon: <BarChart3 className="mr-2" size={16} /> },
                { key: 'data', label: 'Datos', icon: <Database className="mr-2" size={16} /> },
              ] as const).map(item => (
                <button
                  key={item.key}
                  onClick={() => { setCurrentMode(item.key as AppMode); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center px-3 py-2 rounded-md text-left text-sm ${
                    currentMode === item.key ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      {renderContent()}

      {/* Modal para generar factura desde cursos */}
      {showInvoiceFromCourses && (
        <InvoiceFromCourses
          onGenerateInvoice={handleGenerateInvoiceFromCourses}
          onClose={() => setShowInvoiceFromCourses(false)}
        />
      )}

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Volver arriba"
          title="Volver arriba"
          className="fixed bottom-4 right-4 md:bottom-6 md:right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <ArrowUp size={20} />
        </button>
      )}
    </div>
  );
};

export default App;