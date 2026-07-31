import type { Course, Item } from '../types';

const normalizeDescription = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');

export const getCourseInvoiceDescription = (course: Course): string =>
  `${course.courseName} (${course.startDate} - ${course.endDate})`;

/**
 * Invoice courses are stored through courseIds. Older creation flows could also
 * persist the generated course row in invoice.items, causing it to be rendered
 * and added to the total twice. Keep only genuinely additional invoice items.
 */
export const getAdditionalInvoiceItems = (
  items: Item[] | undefined,
  relatedCourses: Course[],
): Item[] => {
  if (!Array.isArray(items) || items.length === 0 || relatedCourses.length === 0) {
    return Array.isArray(items) ? items : [];
  }

  const courseDescriptions = new Set(
    relatedCourses.map((course) => normalizeDescription(getCourseInvoiceDescription(course))),
  );

  return items.filter((item) => !courseDescriptions.has(normalizeDescription(item.description || '')));
};
