import React from 'react';
import { useReactToPrint } from 'react-to-print';
import {
  ArrowUp,
  BarChart3,
  Building2,
  Download,
  FileText,
  GraduationCap,
  LogOut,
  Printer,
  Settings2,
  Sparkles,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import InvoiceForm from './components/InvoiceForm';
import InvoicePreview from './components/InvoicePreview';
import CourseManagement from './components/CourseManagement';
import InvoiceManagement from './components/InvoiceManagement';
import InvoiceFromCourses from './components/InvoiceFromCourses';
import Admin from './components/Admin';
import InvoiceAnalytics from './components/InvoiceAnalytics';
import AuthGate from './components/AuthGate';
import { useAuth } from './auth/AuthContext';
import type { Client, Currency, Invoice, InvoiceFromCourse, IssuerId, Item, Language, TransferOptionId } from './types';
import {
  addInvoice,
  loadTenantBranding,
  initializeAutoSync,
  initializeFromAzure,
  loadClients,
  loadCourses,
  loadInvoices,
  reserveNextInvoiceNumber,
  updateInvoice,
} from './utils/storage';
import {
  applyBrandingToDocument,
  defaultTenantBranding,
  getContrastColor,
  readLogoSource,
  toRgba,
} from './utils/tenantBranding';

type AppMode = 'invoicing' | 'courses' | 'invoices' | 'analytics' | 'admin';

const navigation = [
  { key: 'courses' as const, label: 'Cursos', icon: GraduationCap },
  { key: 'invoicing' as const, label: 'Facturación', icon: FileText },
  { key: 'invoices' as const, label: 'Facturas', icon: Building2 },
  { key: 'analytics' as const, label: 'Análisis', icon: BarChart3 },
  { key: 'admin' as const, label: 'Admin', icon: Settings2 },
];

const AppBody: React.FC = () => {
  const { user, memberships, currentTenant, switchTenant, logout } = useAuth();
  const [currentMode, setCurrentMode] = React.useState<AppMode>('courses');
  const [invoice, setInvoice] = React.useState<Invoice>({
    clientName: '',
    clientNIT: '',
    clientAddress: '',
    clientPhone: '',
    clientCity: '',
    items: [],
    total: 0,
    currency: 'USD',
    transferOptionId: '',
  });
  const [invoiceNumber, setInvoiceNumber] = React.useState('');
  const [paymentTerms, setPaymentTerms] = React.useState(30);
  const [selectedIssuerId, setSelectedIssuerId] = React.useState<IssuerId>('');
  const [language, setLanguage] = React.useState<Language>('es');
  const [selectedTransferOptionId, setSelectedTransferOptionId] = React.useState<TransferOptionId>('');
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const [linkedInvoiceId, setLinkedInvoiceId] = React.useState('');
  const [linkedCourseIds, setLinkedCourseIds] = React.useState<string[]>([]);
  const [showGenerateFromCourses, setShowGenerateFromCourses] = React.useState(false);
  const [tenantStats, setTenantStats] = React.useState({ clients: 0, courses: 0, invoices: 0 });
  const [branding, setBranding] = React.useState(defaultTenantBranding());

  const visibleInvoiceRef = React.useRef<HTMLDivElement>(null);
  const hiddenInvoiceRef = React.useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    content: () => (window.innerWidth < 1024 ? hiddenInvoiceRef.current : visibleInvoiceRef.current),
  });

  const refreshDashboard = React.useCallback(async () => {
    const [clients, courses, invoices] = await Promise.all([loadClients(), loadCourses(), loadInvoices()]);
    setTenantStats({
      clients: clients.length,
      courses: courses.length,
      invoices: invoices.length,
    });
  }, []);

  React.useEffect(() => {
    if (!currentTenant) {
      return;
    }

    const boot = async () => {
      await initializeFromAzure();
      await refreshDashboard();
      initializeAutoSync();
    };

    setInvoice({
      clientName: '',
      clientNIT: '',
      clientAddress: '',
      clientPhone: '',
      clientCity: '',
      items: [],
      total: 0,
      currency: 'USD',
      transferOptionId: '',
    });
    setInvoiceNumber('');
    setLinkedInvoiceId('');
    setLinkedCourseIds([]);
    void boot();
  }, [currentTenant?.tenantId, refreshDashboard]);

  React.useEffect(() => {
    if (!currentTenant) {
      const defaults = applyBrandingToDocument(defaultTenantBranding());
      setBranding(defaults);
      return;
    }

    const refreshBranding = async () => {
      const nextBranding = applyBrandingToDocument(await loadTenantBranding());
      setBranding(nextBranding);
    };

    void refreshBranding();
    window.addEventListener('tenantBrandingUpdated', refreshBranding);

    return () => {
      window.removeEventListener('tenantBrandingUpdated', refreshBranding);
    };
  }, [currentTenant?.tenantId]);

  React.useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 280);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const onMutation = () => {
      void refreshDashboard();
    };

    window.addEventListener('courseUpdated', onMutation);
    window.addEventListener('clientUpdated', onMutation);
    window.addEventListener('invoiceUpdated', onMutation);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('courseUpdated', onMutation);
      window.removeEventListener('clientUpdated', onMutation);
      window.removeEventListener('invoiceUpdated', onMutation);
    };
  }, [refreshDashboard]);

  React.useEffect(() => {
    setInvoice((prev) => ({ ...prev, transferOptionId: selectedTransferOptionId }));
  }, [selectedTransferOptionId]);

  const updateInvoiceDraft = (updatedInvoice: Partial<Invoice>) => {
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
      const items = [...prev.items];
      items[index] = item;
      const total = items.reduce((sum, current) => sum + current.quantity * current.unitPrice, 0);
      return { ...prev, items, total };
    });
  };

  const deleteItem = (index: number) => {
    setInvoice((prev) => {
      const items = prev.items.filter((_, currentIndex) => currentIndex !== index);
      const total = items.reduce((sum, current) => sum + current.quantity * current.unitPrice, 0);
      return { ...prev, items, total };
    });
  };

  const clearInvoice = () => {
    if (!window.confirm('¿Quieres limpiar el borrador actual?')) {
      return;
    }

    setInvoice({
      clientName: '',
      clientNIT: '',
      clientAddress: '',
      clientPhone: '',
      clientCity: '',
      items: [],
      total: 0,
      currency: invoice.currency,
      transferOptionId: selectedTransferOptionId,
    });
    setInvoiceNumber('');
    setLinkedInvoiceId('');
    setLinkedCourseIds([]);
  };

  const handleExportPDF = async () => {
    const node = window.innerWidth < 1024 ? hiddenInvoiceRef.current : visibleInvoiceRef.current;
    if (!node) {
      return;
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const canvas = await html2canvas(node, { scale: 2, logging: false, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;
    const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);

    pdf.addImage(imgData, 'PNG', margin, margin, canvas.width * ratio, canvas.height * ratio);
    pdf.save(`Factura${invoiceNumber || '-borrador'}.pdf`);
  };

  const handleSaveInvoice = async () => {
    if (!invoice.clientName || invoice.items.length === 0) {
      alert('Completa el cliente y al menos un item antes de guardar.');
      return;
    }

    try {
      const clients = await loadClients();
      let clientId = clients.find((client) => client.name === invoice.clientName)?.id || '';

      if (!clientId) {
        const transientClient: Client = {
          id: `temp_client_${Date.now()}`,
          name: invoice.clientName,
          nit: invoice.clientNIT,
          address: invoice.clientAddress,
          phone: invoice.clientPhone,
          city: invoice.clientCity,
        };
        clientId = transientClient.id;
      }

      const hasCourseIds = linkedCourseIds.length > 0;
      let finalInvoiceNumber = invoiceNumber;
      if (!finalInvoiceNumber) {
        finalInvoiceNumber = await reserveNextInvoiceNumber();
        setInvoiceNumber(finalInvoiceNumber);
      }

      let manualItems = invoice.items;
      if (hasCourseIds) {
        const allCourses = await loadCourses();
        const courseDescriptions = allCourses
          .filter((course) => linkedCourseIds.includes(course.id))
          .map((course) => `${course.courseName} (${course.startDate} - ${course.endDate})`);
        manualItems = invoice.items.filter((item) => !courseDescriptions.includes(item.description));
      }

      const invoiceData: Omit<InvoiceFromCourse, 'id'> = {
        clientId,
        courseIds: hasCourseIds ? linkedCourseIds : [],
        invoiceNumber: finalInvoiceNumber,
        invoiceDate: new Date().toISOString().slice(0, 10),
        currency: invoice.currency,
        issuerId: selectedIssuerId,
        language,
        paymentTerms,
        subtotal: invoice.total,
        total: invoice.total,
        status: 'draft',
        transferOptionId: selectedTransferOptionId,
        observations: hasCourseIds
          ? `Factura generada desde cursos: ${invoice.items.map((item) => item.description).join(', ')}`
          : `Factura creada desde el workspace SaaS para ${invoice.clientName}`,
        items: manualItems,
      };

      const invoices = await loadInvoices();
      const existing =
        (linkedInvoiceId && invoices.find((entry) => entry.id === linkedInvoiceId)) ||
        invoices.find((entry) => entry.invoiceNumber === finalInvoiceNumber);

      if (existing) {
        const updated = await updateInvoice(existing.id, invoiceData);
        if (updated) {
          setLinkedInvoiceId(updated.id);
          setLinkedCourseIds(updated.courseIds);
          alert(`Factura ${finalInvoiceNumber} actualizada.`);
          return;
        }
      }

      const created = await addInvoice(invoiceData);
      if (created) {
        setLinkedInvoiceId(created.id);
        setLinkedCourseIds(created.courseIds);
        alert(`Factura ${finalInvoiceNumber} guardada.`);
      } else {
        alert('No se pudo guardar la factura.');
      }
    } catch (error) {
      console.error('Error guardando factura:', error);
      alert('No se pudo guardar la factura.');
    }
  };

  const handleGenerateInvoiceFromCourses = React.useCallback(
    async (items: Item[], clientData: Client, courseIds: string[], nextInvoiceNumber: string, currency: Currency) => {
      const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

      setInvoice({
        clientName: clientData.name,
        clientNIT: clientData.nit,
        clientAddress: clientData.address,
        clientPhone: clientData.phone,
        clientCity: clientData.city,
        items,
        total,
        currency,
        transferOptionId: selectedTransferOptionId,
      });
      setInvoiceNumber(nextInvoiceNumber);
      setLinkedInvoiceId('');
      setLinkedCourseIds(courseIds);
      setCurrentMode('invoicing');
      setShowGenerateFromCourses(false);
    },
    [selectedTransferOptionId],
  );

  const renderContent = () => {
    if (currentMode === 'courses') {
      return <CourseManagement key={`courses-${currentTenant?.tenantId || ''}`} />;
    }
    if (currentMode === 'invoices') {
      return <InvoiceManagement key={`invoices-${currentTenant?.tenantId || ''}`} />;
    }
    if (currentMode === 'analytics') {
      return <InvoiceAnalytics key={`analytics-${currentTenant?.tenantId || ''}`} />;
    }
    if (currentMode === 'admin') {
      return <Admin key={`admin-${currentTenant?.tenantId || ''}`} />;
    }

    return (
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-xl shadow-slate-900/5 backdrop-blur">
          <InvoiceForm
            invoice={invoice}
            updateInvoice={updateInvoiceDraft}
            addItem={addItem}
            editItem={editItem}
            deleteItem={deleteItem}
            selectedIssuerId={selectedIssuerId}
            setSelectedIssuerId={setSelectedIssuerId}
            invoiceNumber={invoiceNumber}
            paymentTerms={paymentTerms}
            setPaymentTerms={setPaymentTerms}
            language={language}
            setLanguage={setLanguage}
            selectedTransferOptionId={selectedTransferOptionId}
            setSelectedTransferOptionId={setSelectedTransferOptionId}
            onGenerateFromCourses={() => setShowGenerateFromCourses(true)}
            onClearInvoice={clearInvoice}
            onSaveInvoice={handleSaveInvoice}
          />
        </section>

        <section className="space-y-4">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/95 p-6 shadow-xl shadow-slate-900/5">
            <div ref={visibleInvoiceRef} className="hidden xl:block">
              <InvoicePreview
                invoice={invoice}
                invoiceNumber={invoiceNumber}
                selectedIssuerId={selectedIssuerId}
                language={language}
                paymentTerms={paymentTerms}
              />
            </div>
            <div className="xl:hidden">
              <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                La previsualización completa vive en escritorio para conservar el formato del PDF. Desde móvil puedes imprimir o exportar sin perder el layout.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                onClick={handlePrint}
                className="inline-flex w-full items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition hover:opacity-95 sm:w-auto"
                style={brandOutlineStyle}
              >
                <Printer className="mr-2" size={16} />
                Imprimir
              </button>
              <button
                onClick={handleExportPDF}
                className="inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-95 sm:w-auto"
                style={brandButtonStyle}
              >
                <Download className="mr-2" size={16} />
                Exportar PDF
              </button>
            </div>
          </div>

          <div
            ref={hiddenInvoiceRef}
            className="pointer-events-none fixed -left-[10000px] -top-[10000px] w-[794px] bg-white p-4"
          >
            <InvoicePreview
              invoice={invoice}
              invoiceNumber={invoiceNumber}
              selectedIssuerId={selectedIssuerId}
              language={language}
              paymentTerms={paymentTerms}
            />
          </div>
        </section>
      </div>
    );
  };

  const brandLogoSrc = readLogoSource(branding);
  const primaryContrast = getContrastColor(branding.primaryColor);
  const shellBackground = {
    backgroundImage: [
      `radial-gradient(circle at top, ${toRgba(branding.accentColor, 0.18)}, transparent 30%)`,
      `linear-gradient(180deg, ${toRgba(branding.surfaceColor, 0.94)} 0%, #f8fafc 42%, ${toRgba(branding.accentColor, 0.06)} 100%)`,
    ].join(','),
  } as React.CSSProperties;
  const brandSoftPillStyle = {
    backgroundColor: toRgba(branding.accentColor, 0.12),
    color: branding.primaryColor,
  } as React.CSSProperties;
  const brandCardStyle = {
    backgroundColor: branding.primaryColor,
    color: primaryContrast,
  } as React.CSSProperties;
  const brandButtonStyle = {
    backgroundColor: branding.primaryColor,
    color: primaryContrast,
  } as React.CSSProperties;
  const brandOutlineStyle = {
    borderColor: toRgba(branding.accentColor, 0.24),
    color: branding.primaryColor,
    backgroundColor: toRgba(branding.surfaceColor, 0.92),
  } as React.CSSProperties;

  return (
    <div className="min-h-screen text-slate-900" style={shellBackground}>
      <header className="z-40 border-b border-white/70 bg-white/80 backdrop-blur-xl lg:sticky lg:top-0">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-2 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]" style={brandSoftPillStyle}>
                <Sparkles size={14} />
                SaaS Multi-tenant
              </div>
              <div className="flex items-start gap-3">
                {brandLogoSrc && (
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-sm sm:h-14 sm:w-14"
                    style={{ borderColor: toRgba(branding.accentColor, 0.2) }}
                  >
                    <img src={brandLogoSrc} alt={`Logo de ${currentTenant?.name || 'tenant'}`} className="h-full w-full object-contain p-2" />
                  </div>
                )}
                <div>
                <h1 className="text-lg font-semibold tracking-tight sm:text-2xl">Sistema de facturación y cursos</h1>
                <p className="text-sm text-slate-600">
                  Tenant activo: <span className="font-semibold text-slate-900">{currentTenant?.name || 'Sin tenant'}</span>
                </p>
                <p className="mt-1 break-all text-xs text-slate-500 sm:hidden">{currentTenant?.tenantId}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:items-center">
              <select
                value={currentTenant?.tenantId || ''}
                onChange={(event) => switchTenant(event.target.value)}
                className="min-w-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm xl:min-w-[16rem]"
              >
                {memberships.map((membership) => (
                  <option key={membership.tenantId} value={membership.tenantId}>
                    {membership.name} · {membership.role}
                  </option>
                ))}
              </select>

              <div className="min-w-0 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm xl:rounded-full">
                <p className="truncate font-semibold text-slate-900">{user?.name}</p>
                <p className="hidden truncate text-xs text-slate-500 sm:block sm:text-sm">{user?.email}</p>
              </div>

              <button
                onClick={() => void logout()}
                className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-95 sm:col-span-2 xl:col-span-1"
                style={brandButtonStyle}
              >
                <LogOut className="mr-2" size={16} />
                Salir
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 sm:hidden">
            <div className="min-w-[220px] rounded-full px-4 py-3 shadow-lg shadow-slate-900/10" style={brandCardStyle}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Tenant ID</p>
              <p className="mt-1 truncate text-sm font-semibold">{currentTenant?.tenantId}</p>
            </div>
            <div className="min-w-[104px] rounded-full border bg-white px-4 py-3 shadow-sm" style={brandOutlineStyle}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Clientes</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{tenantStats.clients}</p>
            </div>
            <div className="min-w-[104px] rounded-full border bg-white px-4 py-3 shadow-sm" style={brandOutlineStyle}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Cursos</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{tenantStats.courses}</p>
            </div>
            <div className="min-w-[104px] rounded-full border bg-white px-4 py-3 shadow-sm" style={brandOutlineStyle}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Facturas</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{tenantStats.invoices}</p>
            </div>
          </div>

          <div className="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
            <div className="rounded-[1.5rem] px-5 py-4 shadow-lg shadow-slate-900/10" style={brandCardStyle}>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Tenant ID</p>
              <p className="mt-2 break-all text-base font-semibold sm:text-lg">{currentTenant?.tenantId}</p>
              <p className="mt-1 text-sm text-slate-300">Aislamiento por datos y configuración desde Azure SQL.</p>
            </div>
            <div className="rounded-[1.5rem] border bg-white px-5 py-4 shadow-sm" style={brandOutlineStyle}>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Clientes</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{tenantStats.clients}</p>
            </div>
            <div className="rounded-[1.5rem] border bg-white px-5 py-4 shadow-sm" style={brandOutlineStyle}>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Cursos</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{tenantStats.courses}</p>
            </div>
            <div className="rounded-[1.5rem] border bg-white px-5 py-4 shadow-sm" style={brandOutlineStyle}>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Facturas</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{tenantStats.invoices}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <nav className="-mx-4 mb-6 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 sm:pb-0">
          <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = currentMode === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setCurrentMode(item.key)}
                  className={`inline-flex items-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? 'shadow-lg shadow-slate-900/10'
                      : 'border bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  style={active ? brandButtonStyle : brandOutlineStyle}
                >
                  <Icon className="mr-2" size={16} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        {renderContent()}
      </main>

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-4 right-4 inline-flex h-11 w-11 items-center justify-center rounded-full shadow-xl shadow-slate-900/20 transition hover:opacity-95 sm:bottom-6 sm:right-6 sm:h-12 sm:w-12"
          style={brandButtonStyle}
          aria-label="Volver arriba"
        >
          <ArrowUp size={18} />
        </button>
      )}

      {showGenerateFromCourses && (
        <InvoiceFromCourses
          onGenerateInvoice={handleGenerateInvoiceFromCourses}
          onClose={() => setShowGenerateFromCourses(false)}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthGate>
      <AppBody />
    </AuthGate>
  );
};

export default App;
