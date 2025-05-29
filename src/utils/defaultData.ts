import { Client } from '../types';

export const defaultClients: Omit<Client, 'id'>[] = [
  {
    name: 'FastLane Colombia S.A.S.',
    nit: '900123456-1',
    address: 'Carrera 7 # 71-21 Torre B Oficina 1205',
    phone: '+57 1 234 5678',
    city: 'Bogotá D.C.',
    email: 'contacto@fastlane.co',
    observations: 'Cliente principal para cursos de tecnología'
  },
  {
    name: 'CAS Training Institute',
    nit: '800987654-2',
    address: 'Calle 100 # 19-61 Piso 8',
    phone: '+57 1 987 6543',
    city: 'Bogotá D.C.',
    email: 'info@castraining.com',
    observations: 'Instituto de capacitación empresarial'
  },
  {
    name: 'Fast Lane Consulting Services Latam',
    nit: '155596520-2-2015',
    address: 'Punta Pacíf, Cll Isaac Hanono Missri. Ed Oceanía Business',
    phone: '(51) 991347214',
    city: 'Ciudad de Panamá, Panamá',
    email: 'latam@fastlane.com',
    observations: 'Oficina regional para Latinoamérica'
  }
];

export const initializeDefaultClients = async () => {
  const { loadClients, addClient } = await import('./storage');
  
  try {
    const existingClients = await loadClients();
    
    // Solo agregar clientes predeterminados si no hay ninguno
    if (existingClients.length === 0) {
      console.log('Inicializando clientes predeterminados...');
      
      for (const clientData of defaultClients) {
        await addClient(clientData);
      }
      
      console.log('Clientes predeterminados agregados exitosamente');
    }
  } catch (error) {
    console.error('Error inicializando clientes predeterminados:', error);
  }
}; 