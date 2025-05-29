import React from 'react';
import { Client } from '../types';
import { Edit2, Trash2, Plus, Building, MapPin, Phone, Mail } from 'lucide-react';

interface ClientListProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

const ClientList: React.FC<ClientListProps> = ({ clients, onEdit, onDelete, onAdd }) => {
  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Clientes</h2>
        <button
          onClick={onAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center"
        >
          <Plus className="mr-2" size={20} />
          Nuevo Cliente
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-12">
          <Building className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay clientes registrados</h3>
          <p className="mt-1 text-sm text-gray-500">Comienza agregando tu primer cliente.</p>
          <div className="mt-6">
            <button
              onClick={onAdd}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2" size={16} />
              Nuevo Cliente
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client) => (
            <div key={client.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Building className="mr-2 text-blue-600" size={20} />
                  {client.name}
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => onEdit(client)}
                    className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                    title="Editar cliente"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(client.id)}
                    className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                    title="Eliminar cliente"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <Building className="mr-2 text-gray-400" size={14} />
                  <span className="font-medium">NIT:</span>
                  <span className="ml-1">{client.nit}</span>
                </div>

                <div className="flex items-center">
                  <MapPin className="mr-2 text-gray-400" size={14} />
                  <span>{client.address}</span>
                </div>

                <div className="flex items-center">
                  <MapPin className="mr-2 text-gray-400" size={14} />
                  <span>{client.city}</span>
                </div>

                <div className="flex items-center">
                  <Phone className="mr-2 text-gray-400" size={14} />
                  <span>{client.phone}</span>
                </div>

                {client.email && (
                  <div className="flex items-center">
                    <Mail className="mr-2 text-gray-400" size={14} />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}

                {client.observations && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500 italic">
                      {client.observations.length > 100 
                        ? `${client.observations.substring(0, 100)}...` 
                        : client.observations
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientList; 