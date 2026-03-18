import React, { useMemo, useState } from 'react';
import { Database } from 'lucide-react';
import DataManagement from './DataManagement';
import ClientManagement from './ClientManagement';

type AdminSection = 'datos' | 'marca' | 'numeracion' | 'nota-legal' | 'instructores' | 'emisores' | 'opc-transf' | 'clientes';

const Admin: React.FC = () => {
  const [section, setSection] = useState<AdminSection>('datos');

  const sections = useMemo(
    () =>
      [
        { key: 'datos' as const, label: 'Datos' },
        { key: 'marca' as const, label: 'Marca' },
        { key: 'numeracion' as const, label: 'Numeración' },
        { key: 'nota-legal' as const, label: 'Nota legal' },
        { key: 'instructores' as const, label: 'Instructores' },
        { key: 'emisores' as const, label: 'Emisores' },
        { key: 'opc-transf' as const, label: 'Opc. de transf.' },
        { key: 'clientes' as const, label: 'Clientes' },
      ],
    []
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-2xl bg-white p-4 shadow-md sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center">
            <Database className="mr-3 text-blue-600" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Admin</h2>
              <p className="text-sm text-gray-600">Configuración y administración</p>
            </div>
          </div>

          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
              {sections.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    section === s.key
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {section === 'clientes' ? (
        <ClientManagement embedded />
      ) : (
        <DataManagement
          embedded
          section={
            section === 'opc-transf'
              ? 'opciones-transferencia'
              : section === 'nota-legal'
                ? 'nota-legal'
                : section
          }
        />
      )}
    </div>
  );
};

export default Admin;
