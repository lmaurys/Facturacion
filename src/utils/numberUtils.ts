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
export const formatCurrency = (amount: number, currency: string = 'USD', locale: string = 'es-ES'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

const getGroupingSeparator = (locale: string): string => {
  try {
    const parts = new Intl.NumberFormat(locale, {
      useGrouping: true,
      maximumFractionDigits: 0
    }).formatToParts(1000);
    return parts.find(p => p.type === 'group')?.value ?? '.';
  } catch {
    return '.';
  }
};

const groupIntegerString = (digits: string, groupSeparator: string): string => {
  // Insert group separator every 3 digits from the end.
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
};

/**
 * Formatea moneda sin decimales (redondeado) y fuerza separador de miles desde 1K.
 * Esto evita locales que solo agrupan desde 10.000.
 */
export const formatCurrencyNoDecimals = (
  amount: number,
  currency: string = 'USD',
  locale: string = 'es-CO',
  forceGroupingFrom: number = 1000
): string => {
  const rounded = Math.round(Number.isFinite(amount) ? amount : 0);
  const absRounded = Math.abs(rounded);
  const groupSeparator = getGroupingSeparator(locale);

  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: false
  }).formatToParts(rounded);

  const integerDigits = String(absRounded);
  const integerFormatted = absRounded >= forceGroupingFrom
    ? groupIntegerString(integerDigits, groupSeparator)
    : integerDigits;

  return parts
    .map((p) => {
      if (p.type === 'integer') return integerFormatted;
      if (p.type === 'decimal' || p.type === 'fraction') return '';
      return p.value;
    })
    .join('');
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