import type { Course } from '../types';
import {
  countScheduledCourseDaysInRange,
  courseRunsOnDate,
  getCourseTimeRangeForZone,
  getCourseWeekdayLabel,
  getWeekCalendarTop,
  isValidCourseTime,
  resolveCourseTimeZoneInput,
} from './courseSchedule';

const course: Course = {
  id: 'course-1',
  courseName: 'Arquitectura Azure',
  startDate: '2026-08-03',
  endDate: '2026-08-14',
  weekdays: [1, 3, 5],
  startTime: '14:00',
  endTime: '16:00',
  timeZone: 'Europe/Madrid',
  hours: 12,
  hourlyRate: 40,
  totalValue: 480,
  currency: 'USD',
  clientId: 'client-1',
  instructorId: 'instructor-1',
  invoiceNumber: '',
  invoiceDate: '',
  status: 'creado',
  paymentDate: '',
  paidAmount: 0,
  observations: '',
};

describe('programación semanal de cursos', () => {
  it('incluye únicamente los días seleccionados dentro del rango', () => {
    expect(countScheduledCourseDaysInRange(course)).toBe(6);
    expect(courseRunsOnDate(course, new Date(2026, 7, 3))).toBe(true);
    expect(courseRunsOnDate(course, new Date(2026, 7, 4))).toBe(false);
    expect(getCourseWeekdayLabel(course.weekdays)).toBe('Lun, Mie, Vie');
  });

  it('convierte el horario a la zona elegida para el calendario', () => {
    const range = getCourseTimeRangeForZone(course, 'America/Bogota', new Date(2026, 7, 3));

    expect(range.startMinutes).toBe(7 * 60);
    expect(range.endMinutes).toBe(9 * 60);
    expect(range.label).toContain('07:00 - 09:00');
    expect(range.label).toContain('origen Europe/Madrid');
  });

  it('posiciona correctamente clases antes de las 06:00 en una grilla de 24 horas', () => {
    const earlyCourse = {
      ...course,
      startTime: '10:00',
      endTime: '16:00',
    };
    const range = getCourseTimeRangeForZone(earlyCourse, 'America/Bogota', new Date(2026, 7, 10));

    expect(range.startMinutes).toBe(3 * 60);
    expect(getWeekCalendarTop(range.startMinutes, 64)).toBe(3 * 64);
  });

  it('resuelve ciudades conocidas y rechaza horas fuera de 24 horas', () => {
    expect(resolveCourseTimeZoneInput('Bogota')).toBe('America/Bogota');
    expect(isValidCourseTime('23:59')).toBe(true);
    expect(isValidCourseTime('24:00')).toBe(false);
    expect(isValidCourseTime('29:00')).toBe(false);
  });
});
