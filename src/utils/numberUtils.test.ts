import { formatCurrency, formatHourlyRate } from './numberUtils';

describe('hourly rate precision', () => {
  it('preserves three decimals when formatting an hourly rate', () => {
    expect(formatHourlyRate(28.125)).toBe('28,125');
    expect(formatCurrency(28.125, 'USD', 'es-ES', 3)).toContain('28,125');
  });

  it('keeps invoice totals at the default two-decimal precision', () => {
    expect(formatCurrency(10.126, 'USD', 'es-ES')).toContain('10,13');
  });
});
