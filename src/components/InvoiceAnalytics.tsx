import React, { useState, useEffect } from 'react';
import { InvoiceFromCourse, Client, Course, Instructor } from '../types';
import { loadInvoices, loadClients, loadCourses, loadInstructors } from '../utils/storage';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, DollarSign, FileText, Users, Calendar, BarChart3 } from 'lucide-react';

interface AnalyticsData {
  monthlyRevenue: Array<{ month: string; paid: number; sent: number; draft: number; invoices: number }>;
  monthlyCoursesCreated: Array<{ month: string; courses: number; totalValue: number }>;
  statusDistribution: Array<{ name: string; value: number; color: string }>;
  topClients: Array<{ 
    name: string; 
    total: number; 
    invoices: number;
    draft: number;
    sent: number;
    paid: number;
    expectedBilling: number;
  }>;
  coursesStatusDistribution: Array<{ name: string; value: number; count: number; colorClass: string }>;
  byInstructor: Array<{ instructor: string; courses: number; totalValue: number; paidCourses: number; billedCourses: number; plannedCourses: number }>;
}

const InvoiceAnalytics: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceFromCourse[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const processAnalytics = React.useCallback(() => {
    // Helper para formatear mes
    // Cursos del año y filtrado por instructor (si aplica)
    const yearCoursesAll = courses.filter(course => 
      new Date(course.startDate).getFullYear() === selectedYear
    );
    const yearCourses = selectedInstructorId === 'all' 
      ? yearCoursesAll 
      : yearCoursesAll.filter(c => c.instructorId === selectedInstructorId);

    const yearCourseIds = new Set(yearCourses.map(c => c.id));

    // Facturas del año y filtradas por cursos del instructor (si aplica)
    const yearInvoicesAll = invoices.filter(invoice => 
      new Date(invoice.invoiceDate).getFullYear() === selectedYear
    );

    // Fallback de relación: si una factura no tiene courseIds (factura tradicional), intentar inferir cursos
    // por invoiceNumber + clientId + año para que aparezca en filtro por instructor si corresponde.
    const invoiceCoursesFallbackMap = new Map<string, string[]>();
    yearInvoicesAll.forEach(inv => {
      if (!inv.courseIds || inv.courseIds.length === 0) {
        const inferred = yearCoursesAll.filter(c => 
          c.invoiceNumber === inv.invoiceNumber && c.clientId === inv.clientId
        ).map(c => c.id);
        if (inferred.length > 0) {
          invoiceCoursesFallbackMap.set(inv.id, inferred);
        }
      }
    });
    const yearInvoices = selectedInstructorId === 'all'
      ? yearInvoicesAll
      : yearInvoicesAll.filter(inv => {
          const ids = inv.courseIds && inv.courseIds.length > 0
            ? inv.courseIds
            : (invoiceCoursesFallbackMap.get(inv.id) || []);
          return ids.some(id => yearCourseIds.has(id));
        });

    // 1. Ingresos mensuales (pagadas, enviadas y borradores)
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const monthInvoices = yearInvoices.filter(invoice => new Date(invoice.invoiceDate).getMonth() === i);
      const paidInvoices = monthInvoices.filter(inv => inv.status === 'paid');
      const sentOnlyInvoices = monthInvoices.filter(inv => inv.status === 'sent');
      const draftInvoices = monthInvoices.filter(inv => inv.status === 'draft');
      return {
        month: new Date(selectedYear, i, 1).toLocaleDateString('es-ES', { month: 'short' }),
        paid: paidInvoices.reduce((sum, inv) => sum + (inv.paidAmount ?? inv.total), 0),
        sent: sentOnlyInvoices.reduce((sum, inv) => sum + inv.total, 0),
        draft: draftInvoices.reduce((sum, inv) => sum + inv.total, 0),
        invoices: monthInvoices.length
      };
    });

    const monthlyCoursesData = Array.from({ length: 12 }, (_, i) => {
      const monthCourses = yearCourses.filter(course => 
        new Date(course.startDate).getMonth() === i
      );
      
      return {
        month: new Date(selectedYear, i, 1).toLocaleDateString('es-ES', { month: 'short' }),
        courses: monthCourses.length,
        totalValue: monthCourses.reduce((sum, course) => sum + course.totalValue, 0)
      };
    });

    // 3. Distribución por estado (por valor total, no cantidad)
    const statusTotals = {
      draft: yearInvoices.filter(inv => inv.status === 'draft').reduce((sum, inv) => sum + inv.total, 0),
      sent: yearInvoices.filter(inv => inv.status === 'sent').reduce((sum, inv) => sum + inv.total, 0),
      paid: yearInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.paidAmount ?? inv.total), 0)
    };

    const statusDistribution = [
      { name: 'Borradores', value: statusTotals.draft, color: '#9CA3AF' },
      { name: 'Enviadas', value: statusTotals.sent, color: '#3B82F6' },
      { name: 'Pagadas', value: statusTotals.paid, color: '#10B981' }
    ].filter(item => item.value > 0); // Solo mostrar estados con valor

    // 4. Top clientes con segmentación por estado
    //    y cálculo de facturación esperada (cursos creados + dictados)
    const expectedBillingByClient = new Map<string, number>();
    yearCourses
      .filter(c => (c.status === 'creado' || c.status === 'dictado'))
      .forEach(course => {
        const current = expectedBillingByClient.get(course.clientId) || 0;
        expectedBillingByClient.set(course.clientId, current + course.totalValue);
      });
    const clientTotals = new Map<string, { 
      total: number; 
      invoices: number; 
      name: string;
      draft: number;
      sent: number;
      paid: number;
      expectedBilling: number;
    }>();
    
    yearInvoices.forEach(invoice => {
      const client = clients.find(c => c.id === invoice.clientId);
      const clientName = client ? client.name : 'Cliente no encontrado';
      
        if (clientTotals.has(invoice.clientId)) {
        const current = clientTotals.get(invoice.clientId)!;
  current.total += invoice.total;
        current.invoices += 1;
        
        // Agregar al estado correspondiente
        if (invoice.status === 'draft') {
          current.draft += invoice.total;
        } else if (invoice.status === 'sent') {
          current.sent += invoice.total;
        } else if (invoice.status === 'paid') {
          current.paid += (invoice.paidAmount ?? invoice.total);
        }
        } else {
        clientTotals.set(invoice.clientId, {
          total: invoice.total,
          invoices: 1,
          name: clientName,
          draft: invoice.status === 'draft' ? invoice.total : 0,
          sent: invoice.status === 'sent' ? invoice.total : 0,
            paid: invoice.status === 'paid' ? (invoice.paidAmount ?? invoice.total) : 0,
            expectedBilling: expectedBillingByClient.get(invoice.clientId) || 0
        });
      }
    });

    // Completar el valor de facturación esperada para clientes ya agregados
    clientTotals.forEach((value, clientId) => {
      value.expectedBilling = expectedBillingByClient.get(clientId) || 0;
    });

    const topClients = Array.from(clientTotals.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // 5. Distribución de cursos por estado (mejorada)
    const coursesByStatus = {
      creado: yearCourses.filter(c => c.status === 'creado'),
      dictado: yearCourses.filter(c => c.status === 'dictado'),
      facturado: yearCourses.filter(c => c.status === 'facturado'),
      pagado: yearCourses.filter(c => c.status === 'pagado')
    };

  const coursesStatusDistribution = Object.entries(coursesByStatus).map(([status, courseList]) => {
      const colorClass = status === 'pagado' ? 'bg-green-500' : 
                         status === 'facturado' ? 'bg-blue-500' : 
                         status === 'dictado' ? 'bg-amber-500' : 'bg-gray-400';
      return {
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: courseList.reduce((sum, course) => sum + course.totalValue, 0),
        count: courseList.length,
        colorClass
      };
    }).filter(item => item.count > 0); // Solo mostrar estados con cursos

    // 6. Distribución por instructor
    const byInstructorMap = new Map<string, { instructor: string; courses: number; totalValue: number; paidCourses: number; billedCourses: number; plannedCourses: number }>();
    yearCourses.forEach(course => {
      const instName = (instructors.find(i => i.id === course.instructorId)?.name) || 'Instructor';
      const current = byInstructorMap.get(instName) || { instructor: instName, courses: 0, totalValue: 0, paidCourses: 0, billedCourses: 0, plannedCourses: 0 };
      current.courses += 1;
      current.totalValue += course.totalValue;
      if (course.status === 'pagado') current.paidCourses += 1;
      else if (course.status === 'facturado') current.billedCourses += 1;
      else current.plannedCourses += 1;
      byInstructorMap.set(instName, current);
    });
    const byInstructor = Array.from(byInstructorMap.values()).sort((a, b) => b.totalValue - a.totalValue);

    setAnalytics({
      monthlyRevenue: monthlyData,
      monthlyCoursesCreated: monthlyCoursesData,
      statusDistribution,
      topClients,
      coursesStatusDistribution,
      byInstructor
    });
  }, [invoices, clients, courses, instructors, selectedYear, selectedInstructorId]);

  useEffect(() => {
    if (invoices.length > 0 && clients.length > 0 && courses.length > 0) {
      processAnalytics();
    }
  }, [invoices, clients, courses, instructors, selectedYear, selectedInstructorId, processAnalytics]);

  const loadData = async () => {
    try {
      const [loadedInvoices, loadedClients, loadedCourses, loadedInstructors] = await Promise.all([
        loadInvoices(),
        loadClients(),
        loadCourses(),
        loadInstructors()
      ]);
      setInvoices(loadedInvoices);
      setClients(loadedClients);
      setCourses(loadedCourses);
      setInstructors(loadedInstructors);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    }
  };


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
  };

  const getPaidRevenue = () => {
    if (!analytics) return 0;
    return analytics.monthlyRevenue.reduce((sum, month) => sum + month.paid, 0);
  };

  const getTotalInvoices = () => {
    const yearInvoicesAll = invoices.filter(inv => new Date(inv.invoiceDate).getFullYear() === selectedYear);
    if (selectedInstructorId === 'all') return yearInvoicesAll.length;
    const yearCoursesAll = courses.filter(course => new Date(course.startDate).getFullYear() === selectedYear);
    const yearCourses = yearCoursesAll.filter(c => c.instructorId === selectedInstructorId);
    const yearCourseIds = new Set(yearCourses.map(c => c.id));
    return yearInvoicesAll.filter(inv => inv.courseIds?.some(id => yearCourseIds.has(id))).length;
  };

  const getUniqueClients = () => {
    const yearInvoicesAll = invoices.filter(inv => new Date(inv.invoiceDate).getFullYear() === selectedYear);
    if (selectedInstructorId === 'all') return new Set(yearInvoicesAll.map(inv => inv.clientId)).size;
    const yearCoursesAll = courses.filter(course => new Date(course.startDate).getFullYear() === selectedYear);
    const yearCourses = yearCoursesAll.filter(c => c.instructorId === selectedInstructorId);
    const yearCourseIds = new Set(yearCourses.map(c => c.id));
    const filteredInv = yearInvoicesAll.filter(inv => inv.courseIds?.some(id => yearCourseIds.has(id)));
    return new Set(filteredInv.map(inv => inv.clientId)).size;
  };

  const getTotalCourses = () => {
    const yearCoursesAll = courses.filter(course => new Date(course.startDate).getFullYear() === selectedYear);
    if (selectedInstructorId === 'all') return yearCoursesAll.length;
    return yearCoursesAll.filter(c => c.instructorId === selectedInstructorId).length;
  };

  const getExpectedBillingTotal = () => {
    const filtered = courses
      .filter(course => new Date(course.startDate).getFullYear() === selectedYear)
      .filter(course => (selectedInstructorId === 'all') || course.instructorId === selectedInstructorId)
      .filter(course => course.status === 'creado' || course.status === 'dictado');
    return filtered.reduce((sum, course) => sum + course.totalValue, 0);
  };

  const getAvailableYears = () => {
    const allYears = [
      ...invoices.map(inv => new Date(inv.invoiceDate).getFullYear()),
      ...courses.map(course => new Date(course.startDate).getFullYear())
    ];
    return [...new Set(allYears)].sort((a, b) => b - a);
  };

  // colores por estado definidos en el render

  const getStatusPercentage = (amount: number, total: number) => {
    return total > 0 ? (amount / total) * 100 : 0;
  };

  if (!analytics) {
    return (
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header y Selector de Año */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <BarChart3 className="mr-3" size={28} />
              Análisis de Facturación
            </h2>
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Año:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Seleccionar año para análisis"
              >
                {getAvailableYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <label className="text-sm font-medium text-gray-700">Instructor:</label>
              <select
                value={selectedInstructorId}
                onChange={(e) => setSelectedInstructorId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Seleccionar instructor para análisis"
              >
                <option value="all">Todos</option>
                {instructors.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </div>
          </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Ingresos Cobrados</p>
                <p className="text-2xl font-bold">{formatCurrency(getPaidRevenue())}</p>
              </div>
              <DollarSign size={32} className="text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Facturas</p>
                <p className="text-2xl font-bold">{formatNumber(getTotalInvoices())}</p>
              </div>
              <FileText size={32} className="text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Clientes Activos</p>
                <p className="text-2xl font-bold">{formatNumber(getUniqueClients())}</p>
              </div>
              <Users size={32} className="text-purple-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Total Cursos</p>
                <p className="text-2xl font-bold">{formatNumber(getTotalCourses())}</p>
              </div>
              <Calendar size={32} className="text-orange-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm">Facturación Esperada</p>
                <p className="text-2xl font-bold">{formatCurrency(getExpectedBillingTotal())}</p>
              </div>
              <TrendingUp size={32} className="text-amber-200" />
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos Principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Por Instructor */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución por Instructor {selectedYear}</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Instructor</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cursos</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Pagados</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Facturados</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Planificados</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics.byInstructor.map((row) => (
                <tr key={row.instructor}>
                  <td className="px-3 py-2 text-sm text-gray-900">{row.instructor}</td>
                  <td className="px-3 py-2 text-sm text-right">{formatNumber(row.courses)}</td>
                  <td className="px-3 py-2 text-sm text-right">{formatCurrency(row.totalValue)}</td>
                  <td className="px-3 py-2 text-sm text-right">{formatNumber(row.paidCourses)}</td>
                  <td className="px-3 py-2 text-sm text-right">{formatNumber(row.billedCourses)}</td>
                  <td className="px-3 py-2 text-sm text-right">{formatNumber(row.plannedCourses)}</td>
                </tr>
              ))}
              {analytics.byInstructor.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">No hay datos por instructor para este año.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        {/* Facturación Mensual (Pagadas, Enviadas, Borradores) */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Facturación Mensual {selectedYear}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString('es-CO')}`} />
              <Tooltip formatter={(value, name) => {
                const nameMap: Record<string, string> = {
                  'paid': 'Pagadas',
                  'sent': 'Enviadas', 
                  'draft': 'Borradores'
                };
                return [formatCurrency(Number(value)), nameMap[name] || name];
              }} />
              <Legend 
                formatter={(value) => {
                  const nameMap: Record<string, string> = {
                    'paid': 'Pagadas',
                    'sent': 'Enviadas',
                    'draft': 'Borradores'
                  };
                  return nameMap[value] || value;
                }}
              />
              <Bar dataKey="paid" stackId="a" fill="#10B981" />
              <Bar dataKey="sent" stackId="a" fill="#3B82F6" />
              <Bar dataKey="draft" stackId="a" fill="#9CA3AF" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {(() => {
              const totals = analytics.monthlyRevenue.reduce((acc, m) => {
                acc.paid += m.paid;
                acc.sent += m.sent;
                acc.draft += m.draft;
                return acc;
              }, { paid: 0, sent: 0, draft: 0 });
              return (
                <>
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <div className="text-green-700 font-medium">Total Pagadas</div>
                    <div className="text-green-800 font-bold">{formatCurrency(totals.paid)}</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <div className="text-blue-700 font-medium">Total Enviadas</div>
                    <div className="text-blue-800 font-bold">{formatCurrency(totals.sent)}</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                    <div className="text-gray-700 font-medium">Total Borradores</div>
                    <div className="text-gray-800 font-bold">{formatCurrency(totals.draft)}</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Cursos Creados por Mes */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cursos Creados por Mes {selectedYear}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.monthlyCoursesCreated}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="courses" orientation="left" tickFormatter={(v)=>formatNumber(Number(v))} />
              <YAxis yAxisId="value" orientation="right" tickFormatter={(value) => `$${value.toLocaleString()}`} />
              <Tooltip formatter={(value, name) => {
                if (name === 'courses') {
                  return [formatNumber(Number(value)), 'Cursos'];
                }
                return [formatCurrency(Number(value)), 'Valor Total'];
              }} />
              <Legend 
                formatter={(value) => {
                  return value === 'courses' ? 'Número de Cursos' : 'Valor Total';
                }}
              />
              <Bar yAxisId="courses" dataKey="courses" fill="#8B5CF6" />
              <Bar yAxisId="value" dataKey="totalValue" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Estados y Análisis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estados de Facturas por Valor */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución de Facturación por Estado</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analytics.statusDistribution}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
              >
                {analytics.statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Valor']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Estados de Cursos */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado de Cursos por Valor {selectedYear}</h3>
          <div className="space-y-3 mb-4">
    {analytics.coursesStatusDistribution.map((status, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
      <div className={`w-4 h-4 rounded-full mr-3 ${status.colorClass}`}></div>
                  <div>
                    <p className="font-medium text-gray-900">{status.name}</p>
                    <p className="text-sm text-gray-600">{formatNumber(status.count)} curso(s)</p>
                  </div>
                </div>
                <p className="font-bold text-gray-900">{formatCurrency(status.value)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Clientes con Segmentación por Estado */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Clientes {selectedYear} - Segmentación por Estado</h3>
        <div className="space-y-4">
          {analytics.topClients.map((client, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 text-lg">{client.name}</h4>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>{formatNumber(client.invoices)} factura(s)</span>
                    <span className="font-bold text-xl text-gray-900">{formatCurrency(client.total)}</span>
                  </div>
            {client.expectedBilling > 0 && (
              <div className="mt-1 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  Esperada: {formatCurrency(client.expectedBilling)}
                </span>
              </div>
            )}
                </div>
              </div>
              
                {/* Detalles por estado */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {client.paid > 0 && (
                    <div className="bg-green-50 p-2 rounded text-center">
                      <div className="font-medium text-green-800">Pagadas</div>
                      <div className="text-green-600">{formatCurrency(client.paid)}</div>
                      <div className="text-green-500">{new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(getStatusPercentage(client.paid, client.total))}%</div>
                    </div>
                  )}
                  {client.sent > 0 && (
                    <div className="bg-blue-50 p-2 rounded text-center">
                      <div className="font-medium text-blue-800">Enviadas</div>
                      <div className="text-blue-600">{formatCurrency(client.sent)}</div>
                      <div className="text-blue-500">{new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(getStatusPercentage(client.sent, client.total))}%</div>
                    </div>
                  )}
                  {client.draft > 0 && (
                    <div className="bg-gray-50 p-2 rounded text-center">
                      <div className="font-medium text-gray-800">Borradores</div>
                      <div className="text-gray-600">{formatCurrency(client.draft)}</div>
                      <div className="text-gray-500">{new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(getStatusPercentage(client.draft, client.total))}%</div>
                    </div>
                  )}
                </div>
              </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
};

export default InvoiceAnalytics; 