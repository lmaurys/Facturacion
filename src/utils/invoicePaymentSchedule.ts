const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseIsoDateToUtc = (dateString: string): number => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return Number.NaN;

  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const formatLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export interface InvoicePaymentSchedule {
  expectedPaymentDate: string;
  daysUntilPayment: number;
  isOverdue: boolean;
}

export const getInvoicePaymentSchedule = (
  invoiceDate: string,
  paymentTerms: number,
  today: Date = new Date()
): InvoicePaymentSchedule => {
  const invoiceUtc = parseIsoDateToUtc(invoiceDate);
  const normalizedTerms = Number.isFinite(paymentTerms) ? Math.trunc(paymentTerms) : 0;
  const expectedUtc = invoiceUtc + normalizedTerms * MS_PER_DAY;
  const expectedPaymentDate = new Date(expectedUtc).toISOString().slice(0, 10);
  const todayUtc = parseIsoDateToUtc(formatLocalDateKey(today));
  const daysUntilPayment = Math.round((expectedUtc - todayUtc) / MS_PER_DAY);

  return {
    expectedPaymentDate,
    daysUntilPayment,
    isOverdue: daysUntilPayment < 0,
  };
};
