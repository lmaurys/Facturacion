import React, { useState, useEffect } from 'react';
import { Client } from '../types';
import ClientList from './ClientList';
import ClientForm from './ClientForm';
import { loadClients, addClient, updateClient, deleteClient } from '../utils/storage';
import { initializeDefaultClients } from '../utils/defaultData';

interface ClientManagementProps {
  embedded?: boolean;
}

const ClientManagement: React.FC<ClientManagementProps> = ({ embedded }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    // Cargar clientes al montar el componente
    const loadClientsAsync = async () => {
      try {
        console.log('🔄 ClientManagement: Cargando clientes...');
        
        // Primero cargar clientes existentes
        const loadedClients = await loadClients();
        console.log(`📊 ClientManagement: ${loadedClients.length} clientes cargados`);
        
        // Solo inicializar clientes predeterminados si realmente no hay ninguno
        if (loadedClients.length === 0) {
          console.log('📝 ClientManagement: Inicializando clientes predeterminados...');
          await initializeDefaultClients();
          
          // Recargar después de la inicialización
          const reloadedClients = await loadClients();
          setClients(reloadedClients);
        } else {
          setClients(loadedClients);
        }
        
        console.log('✅ ClientManagement: Clientes cargados exitosamente');
      } catch (error) {
        console.error('❌ ClientManagement: Error cargando clientes:', error);
        setClients([]);
      }
    };
    
    loadClientsAsync();
  }, []);

  const handleAddClient = () => {
    setEditingClient(null);
    setIsEditing(false);
    setShowForm(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSaveClient = async (clientData: Omit<Client, 'id'>) => {
    try {
      if (isEditing && editingClient) {
        // Actualizar cliente existente
        const updatedClient = await updateClient(editingClient.id, clientData);
        if (updatedClient) {
          setClients(prev => prev.map(client => 
            client.id === editingClient.id ? updatedClient : client
          ));
        }
      } else {
        // Agregar nuevo cliente
        const newClient = await addClient(clientData);
        if (newClient) {
          setClients(prev => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
        }
      }
      
      setShowForm(false);
      setEditingClient(null);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving client:', error);
      alert('Error al guardar el cliente. Por favor, intenta de nuevo.');
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
      try {
        const success = await deleteClient(clientId);
        if (success) {
          setClients(prev => prev.filter(client => client.id !== clientId));
        } else {
          alert('Error al eliminar el cliente.');
        }
      } catch (error) {
        console.error('Error deleting client:', error);
        alert('Error al eliminar el cliente. Por favor, intenta de nuevo.');
      }
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingClient(null);
    setIsEditing(false);
  };

  const content = (
    <div className="max-w-7xl mx-auto">
      <ClientList
        clients={clients}
        onEdit={handleEditClient}
        onDelete={handleDeleteClient}
        onAdd={handleAddClient}
      />

      {showForm && (
        <ClientForm
          client={editingClient}
          onSave={handleSaveClient}
          onCancel={handleCancelForm}
          isEditing={isEditing}
        />
      )}
    </div>
  );

  return embedded ? (
    <>{content}</>
  ) : (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      {content}
    </div>
  );
};

export default ClientManagement; 