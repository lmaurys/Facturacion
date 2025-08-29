import { Client } from '../types';

// NO MÁS DATOS DE EJEMPLO - SOLO DATOS REALES DE AZURE
export const defaultClients: Omit<Client, 'id'>[] = [];

// Flags desactivados - no más inicialización automática de datos inventados

export const initializeDefaultClients = async () => {
  // NO HACER NADA - Solo datos reales de Azure
  console.log('🚫 initializeDefaultClients DESACTIVADO - Solo datos reales de Azure');
  return;
};

// Función para resetear el flag (útil para testing)
export const resetInitializationFlag = () => {
  // No-op
}; 