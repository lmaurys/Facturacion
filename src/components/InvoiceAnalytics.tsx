import React, { useState, useEffect } from 'react';
import { InvoiceFromCourse, Client, Course } from '../types';
import { loadInvoices, loadClients, loadCourses } from '../utils/storage';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, FileText, Users, Calendar, BarChart3 } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';

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
  coursesStatusDistribution: Array<{ name: string; value: number; count: number; color: string }>;
}

const InvoiceAnalytics: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceFromCourse[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (invoices.length > 0 && clients.length > 0 && courses.length > 0) {
      processAnalytics();
    }
  }, [invoices, clients, courses, selectedYear]);

  const loadData = async () => {
    try {
      const [loadedInvoices, loadedClients, loadedCourses] = await Promise.all([
        loadInvoices(),
        loadClients(),
        loadCourses()
      ]);
      setInvoices(loadedInvoices);
      setClients(loadedClients);
      setCourses(loadedCourses);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    }
  };

  const processAnalytics = () => {
    // Filtrar facturas del año seleccionado
    const yearInvoices = invoices.filter(invoice => 
      new Date(invoice.invoiceDate).getFullYear() === selectedYear
    );

    // 1. Ingresos mensuales (pagadas, enviadas y borradores)
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const monthInvoices = yearInvoices.filter(invoice => 
        new Date(invoice.invoiceDate).getMonth() === i
      );
      
      const paidInvoices = monthInvoices.filter(inv => inv.status === 'paid');
      const sentInvoices = monthInvoices.filter(inv => inv.status === 'sent');
      const draftInvoices = monthInvoices.filter(inv => inv.status === 'draft');
      
      return {
        month: new Date(selectedYear, i, 1).toLocaleDateString('es-ES', { month: 'short' }),
        paid: paidInvoices.reduce((sum, inv) => sum + inv.total, 0),
        sent: sentInvoices.reduce((sum, inv) => sum + inv.total, 0),
        draft: draftInvoices.reduce((sum, inv) => sum + inv.total, 0),
        invoices: monthInvoices.length
      };
    });

    // 2. Cursos creados por mes
    const yearCourses = courses.filter(course => 
      new Date(course.startDate).getFullYear() === selectedYear
    );

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
      paid: yearInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0)
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
      .filter(c => c.status === 'creado' || c.status === 'dictado')
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
          current.paid += invoice.total;
        }
        } else {
        clientTotals.set(invoice.clientId, {
          total: invoice.total,
          invoices: 1,
          name: clientName,
          draft: invoice.status === 'draft' ? invoice.total : 0,
          sent: invoice.status === 'sent' ? invoice.total : 0,
            paid: invoice.status === 'paid' ? invoice.total : 0,
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

    const coursesStatusDistribution = Object.entries(coursesByStatus).map(([status, courseList]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: courseList.reduce((sum, course) => sum + course.totalValue, 0),
      count: courseList.length,
      color: status === 'pagado' ? '#10B981' : 
             status === 'facturado' ? '#3B82F6' : 
             status === 'dictado' ? '#F59E0B' : '#9CA3AF'
    })).filter(item => item.count > 0); // Solo mostrar estados con cursos

    setAnalytics({
      monthlyRevenue: monthlyData,
      monthlyCoursesCreated: monthlyCoursesData,
      statusDistribution,
      topClients,
      coursesStatusDistribution
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getTotalRevenue = () => {
    if (!analytics) return 0;
    return analytics.monthlyRevenue.reduce((sum, month) => sum + month.paid + month.sent + month.draft, 0);
  };

  const getPaidRevenue = () => {
    if (!analytics) return 0;
    return analytics.monthlyRevenue.reduce((sum, month) => sum + month.paid, 0);
  };

  const getTotalInvoices = () => {
    return invoices.filter(inv => 
      new Date(inv.invoiceDate).getFullYear() === selectedYear
    ).length;
  };

  const getUniqueClients = () => {
    const yearInvoices = invoices.filter(inv => 
      new Date(inv.invoiceDate).getFullYear() === selectedYear
    );
    return new Set(yearInvoices.map(inv => inv.clientId)).size;
  };

  const getTotalCourses = () => {
    return courses.filter(course => 
      new Date(course.startDate).getFullYear() === selectedYear
    ).length;
  };

  const getExpectedBillingTotal = () => {
    return courses
      .filter(course => new Date(course.startDate).getFullYear() === selectedYear)
      .filter(course => course.status === 'creado' || course.status === 'dictado')
      .reduce((sum, course) => sum + course.totalValue, 0);
  };

  const getAvailableYears = () => {
    const allYears = [
      ...invoices.map(inv => new Date(inv.invoiceDate).getFullYear()),
      ...courses.map(course => new Date(course.startDate).getFullYear())
    ];
    return [...new Set(allYears)].sort((a, b) => b - a);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#10B981';
      case 'sent': return '#3B82F6';
      case 'draft': return '#9CA3AF';
      default: return '#6B7280';
    }
  };

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
                <p className="text-2xl font-bold">{getTotalInvoices()}</p>
              </div>
              <FileText size={32} className="text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Clientes Activos</p>
                <p className="text-2xl font-bold">{getUniqueClients()}</p>
              </div>
              <Users size={32} className="text-purple-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Total Cursos</p>
                <p className="text-2xl font-bold">{getTotalCourses()}</p>
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
        {/* Facturación Mensual (Pagadas, Enviadas, Borradores) */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Facturación Mensual {selectedYear}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
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
        </div>

        {/* Cursos Creados por Mes */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cursos Creados por Mes {selectedYear}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.monthlyCoursesCreated}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="courses" orientation="left" />
              <YAxis yAxisId="value" orientation="right" tickFormatter={(value) => `$${value.toLocaleString()}`} />
              <Tooltip formatter={(value, name) => {
                if (name === 'courses') {
                  return [value, 'Cursos'];
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
                  <div 
                    className="w-4 h-4 rounded-full mr-3" 
                    style={{ backgroundColor: status.color }}
                  ></div>
                  <div>
                    <p className="font-medium text-gray-900">{status.name}</p>
                    <p className="text-sm text-gray-600">{status.count} curso(s)</p>
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
                    <span>{client.invoices} factura(s)</span>
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
              
              {/* Barra de progreso por estados */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Distribución por Estado</span>
                  <span>100%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div className="h-full flex">
                    {client.paid > 0 && (
                      <div 
                        className="bg-green-500 h-full flex items-center justify-center"
                        style={{ width: `${getStatusPercentage(client.paid, client.total)}%` }}
                        title={`Pagadas: ${formatCurrency(client.paid)}`}
                      >
                      </div>
                    )}
                    {client.sent > 0 && (
                      <div 
                        className="bg-blue-500 h-full flex items-center justify-center"
                        style={{ width: `${getStatusPercentage(client.sent, client.total)}%` }}
                        title={`Enviadas: ${formatCurrency(client.sent)}`}
                      >
                      </div>
                    )}
                    {client.draft > 0 && (
                      <div 
                        className="bg-gray-400 h-full flex items-center justify-center"
                        style={{ width: `${getStatusPercentage(client.draft, client.total)}%` }}
                        title={`Borradores: ${formatCurrency(client.draft)}`}
                      >
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
                      <div className="text-green-500">{getStatusPercentage(client.paid, client.total).toFixed(1)}%</div>
                    </div>
                  )}
                  {client.sent > 0 && (
                    <div className="bg-blue-50 p-2 rounded text-center">
                      <div className="font-medium text-blue-800">Enviadas</div>
                      <div className="text-blue-600">{formatCurrency(client.sent)}</div>
                      <div className="text-blue-500">{getStatusPercentage(client.sent, client.total).toFixed(1)}%</div>
                    </div>
                  )}
                  {client.draft > 0 && (
                    <div className="bg-gray-50 p-2 rounded text-center">
                      <div className="font-medium text-gray-800">Borradores</div>
                      <div className="text-gray-600">{formatCurrency(client.draft)}</div>
                      <div className="text-gray-500">{getStatusPercentage(client.draft, client.total).toFixed(1)}%</div>
                    </div>
                  )}
                </div>
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