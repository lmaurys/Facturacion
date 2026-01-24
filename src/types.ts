export interface Item {
  description: string;
  quantity: number;
  unitPrice: number;
}

export type Currency = 'USD' | 'COP' | 'EUR';

export type IssuerId = string;
export type TransferOptionId = string;

export interface IssuerProfile {
  id: IssuerId;
  label: string;
  name: string;
  nit: string;
  address: string;
  phone: string;
  city: string;
  email: string;
  /**
   * Logo del emisor. Preferible usar Data URL (data:image/...) para evitar problemas de CORS en PDF.
   * Si usas URL remota, debe permitir CORS para que html2canvas pueda capturarla.
   */
  logoDataUrl?: string;
  logoUrl?: string;
}

export interface TransferOptionProfile {
  id: TransferOptionId;
  label: string;
  bankName: string;
  bankAddress: string;
  country: string;
  swiftCode: string;
  accountOwner: string;
  accountNumber: {
    es: string;
    en: string;
  };
  accountOwnerAddress: string;
  routingNumber?: string;
  abaCode?: string;
}

export interface Invoice {
  clientName: string;
  clientNIT: string;
  clientAddress: string;
  clientPhone: string;
  clientCity: string;
  items: Item[];
  total: number;
  currency: Currency;
  transferOptionId: TransferOptionId;
}

export interface Course {
  id: string;
  courseName: string;
  startDate: string;
  endDate: string;
  hours: number;
  hourlyRate: number;
  totalValue: number;
  currency: Currency;
  clientId: string; // Ahora referencia al ID del cliente
  instructorId: string; // Referencia al instructor que dicta el curso
  invoiceNumber: string;
  invoiceDate: string;
  status: 'creado' | 'dictado' | 'facturado' | 'pagado';
  paymentDate: string;
  paidAmount: number;
  observations: string;
}

export interface Client {
  id: string;
  name: string;
  nit: string;
  address: string;
  phone: string;
  city: string;
  email?: string;
  observations?: string;
}

export interface InvoiceFromCourse {
  id: string;
  clientId: string;
  courseIds: string[]; // Cursos incluidos en esta factura
  invoiceNumber: string;
  invoiceDate: string;
  currency: Currency;
  issuerId: IssuerId;
  language: Language;
  paymentTerms: number;
  subtotal: number;
  total: number;
  status: 'draft' | 'sent' | 'paid';
  transferOptionId: TransferOptionId;
  observations?: string;
  paymentDate?: string; // Fecha en que se pagó la factura
  paidAmount?: number;  // Valor pagado de la factura
  items?: Item[];       // Items adicionales no asociados a cursos
}
export type Language = 'es' | 'en';

export interface Instructor {
  id: string;
  name: string;
  active: boolean;
}

export interface Blackout {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason: string;
  type: 'personal' | 'holiday' | 'travel' | 'other';
}

export interface InvoiceNumberingSettings {
  prefix: string;
  startNumber: number;
  nextNumber?: number;
}

export interface InvoiceFooterNote {
  id: string;
  effectiveFrom: string; // YYYY-MM-DD
  es: string;
  en: string;
}

export const supportedCurrencies: readonly Currency[] = ['USD', 'COP', 'EUR'] as const;