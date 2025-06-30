/**
 * Formatea las horas con máximo 2 decimales
 */
export const formatHours = (hours: number): string => {
  return hours.toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

/**
 * Formatea el valor por hora con máximo 2 decimales para mostrar
 */
export const formatHourlyRate = (rate: number): string => {
  return rate.toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

/**
 * Formatea valores monetarios con máximo 2 decimales
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Formatea valores monetarios sin símbolo de moneda, con máximo 2 decimales
 */
export const formatAmount = (amount: number): string => {
  return amount.toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}; 