import React, { useMemo, useState } from 'react';
import { Database } from 'lucide-react';
import DataManagement from './DataManagement';
import ClientManagement from './ClientManagement';

type AdminSection = 'datos' | 'numeracion' | 'nota-legal' | 'instructores' | 'emisores' | 'opc-transf' | 'clientes';

const Admin: React.FC = () => {
  const [section, setSection] = useState<AdminSection>('datos');

  const sections = useMemo(
    () =>
      [
        { key: 'datos' as const, label: 'Datos' },
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
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center">
              <Database className="mr-3 text-blue-600" size={24} />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Admin</h2>
                <p className="text-sm text-gray-600">Configuración y administración</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {sections.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
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
    </div>
  );
};

export default Admin;
