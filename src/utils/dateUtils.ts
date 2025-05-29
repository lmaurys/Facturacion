/**
 * Utilidades para formateo de fechas que evitan problemas de zona horaria
 */

/**
 * Formatea una fecha en formato YYYY-MM-DD a DD/MM/YYYY en español
 * Evita problemas de zona horaria agregando hora local
 */
export const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  
  // Agregar 'T00:00:00' para evitar problemas de zona horaria
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('es-ES');
};

/**
 * Formatea una fecha para mostrar en inputs de tipo date (YYYY-MM-DD)
 */
export const formatDateForInput = (dateString: string): string => {
  if (!dateString) return '';
  
  // Si ya está en formato YYYY-MM-DD, retornarlo tal como está
  if (dateString.includes('-') && dateString.length === 10) {
    return dateString;
  }
  
  // Si es un objeto Date, convertirlo a formato YYYY-MM-DD
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
};

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD para inputs
 */
export const getCurrentDateForInput = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

/**
 * Formatea una fecha completa con hora
 */
export const formatDateTime = (dateString: string): string => {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  return date.toLocaleString('es-ES');
}; 