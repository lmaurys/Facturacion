import { addInvoice, loadInvoices } from './storage';
import { InvoiceFromCourse, Item } from '../types';

describe('Invoice item persistence', () => {
  it('should persist manual items in InvoiceFromCourse', async () => {
    const items: Item[] = [
      { description: 'Servicio especial', quantity: 2, unitPrice: 150 },
      { description: 'Material adicional', quantity: 1, unitPrice: 50 }
    ];
    const invoiceData = {
      clientId: 'test-client',
      courseIds: [],
      invoiceNumber: 'TEST-001',
      invoiceDate: '2025-10-05',
      issuer: 'colombia' as const,
      language: 'es' as const,
      paymentTerms: 30,
      subtotal: 350,
      total: 350,
      status: 'draft' as const,
      transferOption: 'usa' as const,
      observations: 'Factura de prueba',
      items
    };
    const saved = await addInvoice(invoiceData);
    expect(saved).toBeTruthy();
    expect(saved?.items).toEqual(items);

    const allInvoices = await loadInvoices();
    const found = allInvoices.find(inv => inv.invoiceNumber === 'TEST-001');
    expect(found).toBeTruthy();
    expect(found?.items).toEqual(items);
  });
});
