export interface Item {
  description: string;
  quantity: number;
  unitPrice: number;
}

export type TransferOption = 'usa' | 'panama' | 'colombia';

export interface Invoice {
  clientName: string;
  clientNIT: string;
  clientAddress: string;
  clientPhone: string;
  clientCity: string;
  items: Item[];
  total: number;
  transferOption: TransferOption;
}

export interface Course {
  id: string;
  courseName: string;
  startDate: string;
  endDate: string;
  hours: number;
  hourlyRate: number;
  totalValue: number;
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
  issuer: Issuer;
  language: Language;
  paymentTerms: number;
  subtotal: number;
  total: number;
  status: 'draft' | 'sent' | 'paid';
  transferOption: TransferOption;
  observations?: string;
  paymentDate?: string; // Fecha en que se pagó la factura
  paidAmount?: number;  // Valor pagado de la factura
  items?: Item[];       // Items adicionales no asociados a cursos
}

export type Issuer = 'colombia' | 'usa';

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

export const issuers: Record<Issuer, {
  name: string;
  nit: string;
  address: string;
  phone: string;
  city: string;
  email: string;
}> = {
  colombia: {
    name: 'LUIS ORLANDO MAURY SANCHEZ',
    nit: 'NIT 79.744.795-7',
    address: 'CARRERA 6 14-37 SUR CASA 105',
    phone: '3176350333',
    city: 'Mosquera - Colombia',
    email: 'mauryorlando@hotmail.com'
  },
  usa: {
    name: 'LUIS ORLANDO MAURY SANCHEZ',
    nit: 'ITIN 978-99-9597',
    address: '12019 Suellen Circle, 33414',
    phone: '+1 4075297158',
    city: 'Wellington, FL',
    email: 'mauryorlando@hotmail.com'
  }
};