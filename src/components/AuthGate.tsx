import React from 'react';
import { Building2, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { toRgba } from '../utils/tenantBranding';

const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, error, login } = useAuth();

  if (status === 'signed-in') {
    return <>{children}</>;
  }

  const isLoading = status === 'checking';
  const isMisconfigured = status === 'misconfigured';

  return (
    <div
      className="min-h-screen px-4 py-12 text-slate-900"
      style={{
        backgroundImage: `radial-gradient(circle at top, ${toRgba('#0ea5e9', 0.25)}, transparent 32%), linear-gradient(135deg, #06202b 0%, #0f3d4c 45%, #f3f7f8 100%)`,
      }}
    >
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm backdrop-blur">
            <ShieldCheck size={16} />
            SaaS multi-tenant sobre Azure SQL + Entra ID
          </div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Facturación y operación académica con aislamiento real por tenant.
            </h1>
            <p className="max-w-2xl text-base text-sky-50/90 sm:text-lg">
              Cada cuenta entra por Entra ID, trabaja sobre su propio `tenantId` y persiste en Azure SQL en vez de depender de un JSON compartido.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <Building2 className="mb-3" size={20} />
              <p className="text-sm font-medium">Tenant aislado</p>
              <p className="mt-1 text-sm text-sky-50/80">Clientes, cursos, facturas y configuración segmentados.</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <KeyRound className="mb-3" size={20} />
              <p className="text-sm font-medium">Acceso corporativo</p>
              <p className="mt-1 text-sm text-sky-50/80">Inicio de sesión directo con Microsoft Entra ID.</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <ShieldCheck className="mb-3" size={20} />
              <p className="text-sm font-medium">Base SQL operativa</p>
              <p className="mt-1 text-sm text-sky-50/80">Modelo preparado para crecer desde una base pequeña y económica.</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/50 bg-white/80 p-8 shadow-2xl shadow-slate-900/10 backdrop-blur">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">Acceso</p>
            <h2 className="text-3xl font-semibold text-slate-900">
              {isMisconfigured ? 'Configura Entra ID' : 'Ingresa a tu espacio'}
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              {isMisconfigured
                ? 'No se pudo cargar la configuración de acceso SaaS. Verifica la configuración de Entra ID y del servidor.'
                : 'Usa tu cuenta corporativa o personal para ingresar a tu espacio y trabajar con datos aislados por tenant.'}
            </p>
          </div>

          <div className="mt-8 space-y-4">
            {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

            <button
              onClick={() => void login()}
              disabled={isLoading || isMisconfigured}
              className="brand-solid inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white"
            >
              {isLoading ? 'Validando sesión...' : 'Entrar con Microsoft'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AuthGate;
