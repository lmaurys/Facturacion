import { getInvoicePaymentSchedule } from './invoicePaymentSchedule';

describe('programación estimada de pagos', () => {
  it('calcula la fecha estimada usando la fecha de factura y los términos de pago', () => {
    const schedule = getInvoicePaymentSchedule('2026-09-30', 30, new Date(2026, 9, 8));

    expect(schedule).toEqual({
      expectedPaymentDate: '2026-10-30',
      daysUntilPayment: 22,
      isOverdue: false,
    });
  });

  it('marca como vencida una factura cuya fecha estimada ya pasó', () => {
    const schedule = getInvoicePaymentSchedule('2026-09-01', 30, new Date(2026, 9, 8));

    expect(schedule.expectedPaymentDate).toBe('2026-10-01');
    expect(schedule.daysUntilPayment).toBe(-7);
    expect(schedule.isOverdue).toBe(true);
  });

  it('mantiene como pendiente una factura que vence hoy', () => {
    const schedule = getInvoicePaymentSchedule('2026-09-08', 30, new Date(2026, 9, 8));

    expect(schedule.expectedPaymentDate).toBe('2026-10-08');
    expect(schedule.daysUntilPayment).toBe(0);
    expect(schedule.isOverdue).toBe(false);
  });
});
