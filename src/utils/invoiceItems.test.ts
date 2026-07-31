import type { Course, Item } from '../types';
import { getAdditionalInvoiceItems, getCourseInvoiceDescription } from './invoiceItems';

const course: Course = {
  id: 'course-1',
  courseName: 'AZ-400T00: DevOps solutions',
  startDate: '2026-07-27',
  endDate: '2026-07-30',
  hours: 32,
  hourlyRate: 28.125,
  totalValue: 900,
  currency: 'USD',
  clientId: 'client-1',
  instructorId: 'instructor-1',
  invoiceNumber: '100',
  invoiceDate: '2026-07-31',
  status: 'facturado',
  paymentDate: '',
  paidAmount: 0,
  observations: '',
};

describe('invoice item separation', () => {
  it('removes a generated course row from additional items', () => {
    const items: Item[] = [
      { description: getCourseInvoiceDescription(course), quantity: 32, unitPrice: 28.125 },
      { description: 'Material adicional', quantity: 1, unitPrice: 25 },
    ];

    expect(getAdditionalInvoiceItems(items, [course])).toEqual([
      { description: 'Material adicional', quantity: 1, unitPrice: 25 },
    ]);
  });

  it('matches generated descriptions despite harmless whitespace and casing differences', () => {
    const items: Item[] = [
      {
        description: '  az-400t00: devops solutions   (2026-07-27 - 2026-07-30) ',
        quantity: 32,
        unitPrice: 28.125,
      },
    ];

    expect(getAdditionalInvoiceItems(items, [course])).toEqual([]);
  });

  it('does not remove repeated manual items when no course backs them', () => {
    const items: Item[] = [
      { description: 'Consultoría', quantity: 1, unitPrice: 100 },
      { description: 'Consultoría', quantity: 1, unitPrice: 100 },
    ];

    expect(getAdditionalInvoiceItems(items, [])).toEqual(items);
  });
});
