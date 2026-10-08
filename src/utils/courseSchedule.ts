import { Course } from '../types';

export const COURSE_WEEKDAYS = [
  { value: 0, shortLabel: 'Dom', label: 'Domingo' },
  { value: 1, shortLabel: 'Lun', label: 'Lunes' },
  { value: 2, shortLabel: 'Mar', label: 'Martes' },
  { value: 3, shortLabel: 'Mie', label: 'Miercoles' },
  { value: 4, shortLabel: 'Jue', label: 'Jueves' },
  { value: 5, shortLabel: 'Vie', label: 'Viernes' },
  { value: 6, shortLabel: 'Sab', label: 'Sabado' },
] as const;

export const COURSE_WEEKDAY_VALUES = COURSE_WEEKDAYS.map(day => day.value);

export interface CourseTimeZoneOption {
  value: string;
  label: string;
  searchText: string;
}

const PREFERRED_TIME_ZONES = [
  'America/Bogota',
  'America/Lima',
  'America/Mexico_City',
  'America/New_York',
  'America/Panama',
  'America/Guayaquil',
  'America/Caracas',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/Madrid',
  'Europe/London',
  'Europe/Paris',
  'UTC',
];

const TIME_ZONE_ALIASES: Record<string, string[]> = {
  'America/Bogota': ['Bogota', 'Colombia', 'Medellin', 'Cali', 'Barranquilla', 'Cartagena'],
  'America/Lima': ['Lima', 'Peru'],
  'America/Mexico_City': ['Ciudad de Mexico', 'CDMX', 'Mexico'],
  'America/New_York': ['New York', 'Nueva York', 'Eastern', 'ET'],
  'America/Panama': ['Panama'],
  'America/Guayaquil': ['Guayaquil', 'Quito', 'Ecuador'],
  'America/Caracas': ['Caracas', 'Venezuela'],
  'America/Santiago': ['Santiago', 'Chile'],
  'America/Argentina/Buenos_Aires': ['Buenos Aires', 'Argentina'],
  'America/Sao_Paulo': ['Sao Paulo', 'Brasil', 'Brazil'],
  'America/Chicago': ['Chicago', 'Central', 'CT'],
  'America/Denver': ['Denver', 'Mountain', 'MT'],
  'America/Los_Angeles': ['Los Angeles', 'Pacific', 'PT'],
  'Europe/Madrid': ['Madrid', 'Espana', 'Spain'],
  'Europe/London': ['London', 'Londres', 'Reino Unido', 'UK'],
  'Europe/Paris': ['Paris', 'Francia', 'France'],
  UTC: ['UTC', 'GMT'],
};

const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const getSupportedTimeZones = (): string[] => {
  const intlWithSupportedValues = Intl as typeof Intl & {
    supportedValuesOf?: (key: 'timeZone') => string[];
  };

  try {
    return intlWithSupportedValues.supportedValuesOf?.('timeZone') || [];
  } catch {
    return [];
  }
};

const formatTimeZoneCity = (timeZone: string): string => {
  const parts = timeZone.split('/');
  const city = parts[parts.length - 1] || timeZone;
  return city.replace(/_/g, ' ');
};

const buildTimeZoneOption = (timeZone: string): CourseTimeZoneOption => {
  const aliases = TIME_ZONE_ALIASES[timeZone] || [];
  const region = timeZone.includes('/') ? timeZone.split('/')[0] : '';
  const city = formatTimeZoneCity(timeZone);
  const label = aliases.length > 0
    ? `${aliases[0]} - ${timeZone}`
    : `${city} - ${timeZone}`;
  const searchText = normalizeSearchText([timeZone, region, city, ...aliases].join(' '));

  return { value: timeZone, label, searchText };
};

export const COURSE_TIME_ZONE_OPTIONS: CourseTimeZoneOption[] = (() => {
  const supported = getSupportedTimeZones();
  const all = Array.from(new Set([...PREFERRED_TIME_ZONES, ...supported])).sort((a, b) => {
    const preferredA = PREFERRED_TIME_ZONES.indexOf(a);
    const preferredB = PREFERRED_TIME_ZONES.indexOf(b);
    if (preferredA !== -1 || preferredB !== -1) {
      return (preferredA === -1 ? Number.MAX_SAFE_INTEGER : preferredA) - (preferredB === -1 ? Number.MAX_SAFE_INTEGER : preferredB);
    }
    return a.localeCompare(b);
  });

  return all.map(buildTimeZoneOption);
})();

export const DEFAULT_COURSE_START_TIME = '08:00';
export const DEFAULT_COURSE_END_TIME = '17:00';
export const DEFAULT_COURSE_TIME_ZONE = 'America/Bogota';
export const WEEK_CALENDAR_START_HOUR = 0;
export const WEEK_CALENDAR_END_HOUR = 24;

export const createLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const formatLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const normalizeCourseWeekdays = (weekdays?: number[]): number[] => {
  if (!Array.isArray(weekdays) || weekdays.length === 0) {
    return [...COURSE_WEEKDAY_VALUES];
  }

  const allowed = new Set(COURSE_WEEKDAY_VALUES);
  return Array.from(new Set(weekdays))
    .filter(day => allowed.has(day as (typeof COURSE_WEEKDAY_VALUES)[number]))
    .sort((a, b) => a - b);
};

export const normalizeCourseExcludedDates = (excludedDates?: string[]): string[] => {
  if (!Array.isArray(excludedDates)) return [];

  return Array.from(new Set(excludedDates))
    .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
};

export const courseRunsOnDate = (course: Course, date: Date): boolean => {
  const startDate = createLocalDate(course.startDate);
  const endDate = createLocalDate(course.endDate);
  const dayDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dayDate < startDate || dayDate > endDate) {
    return false;
  }

  if (normalizeCourseExcludedDates(course.excludedDates).includes(formatLocalDateKey(dayDate))) {
    return false;
  }

  return normalizeCourseWeekdays(course.weekdays).includes(dayDate.getDay());
};

export const countScheduledCourseDaysInRange = (course: Course, rangeStart?: Date, rangeEnd?: Date): number => {
  const courseStart = createLocalDate(course.startDate);
  const courseEnd = createLocalDate(course.endDate);
  const start = rangeStart && rangeStart > courseStart ? rangeStart : courseStart;
  const end = rangeEnd && rangeEnd < courseEnd ? rangeEnd : courseEnd;

  if (end < start) {
    return 0;
  }

  const weekdays = normalizeCourseWeekdays(course.weekdays);
  const excludedDates = new Set(normalizeCourseExcludedDates(course.excludedDates));
  let count = 0;
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  while (current <= end) {
    if (weekdays.includes(current.getDay()) && !excludedDates.has(formatLocalDateKey(current))) {
      count += 1;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
};

export const getCourseWeekdayLabel = (weekdays?: number[]): string => {
  const normalized = normalizeCourseWeekdays(weekdays);

  if (normalized.length === COURSE_WEEKDAY_VALUES.length) {
    return 'Todos los dias';
  }

  return COURSE_WEEKDAYS
    .filter(day => normalized.includes(day.value))
    .map(day => day.shortLabel)
    .join(', ');
};

export const getBrowserTimeZone = (): string => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timeZone || DEFAULT_COURSE_TIME_ZONE;
};

export const getCourseTimeZoneOptions = (query: string, limit = 12): CourseTimeZoneOption[] => {
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) {
    return COURSE_TIME_ZONE_OPTIONS.slice(0, limit);
  }

  return COURSE_TIME_ZONE_OPTIONS
    .filter(option => option.searchText.includes(normalizedQuery) || normalizeSearchText(option.label).includes(normalizedQuery))
    .slice(0, limit);
};

export const resolveCourseTimeZoneInput = (input: string, fallback?: string): string | null => {
  const normalizedInput = normalizeSearchText(input.trim());
  const exact = COURSE_TIME_ZONE_OPTIONS.find(option =>
    normalizeSearchText(option.value) === normalizedInput ||
    normalizeSearchText(option.label) === normalizedInput
  );

  if (exact) {
    return exact.value;
  }

  const matches = getCourseTimeZoneOptions(input, 2);
  if (matches.length === 1) {
    return matches[0].value;
  }

  if (fallback && COURSE_TIME_ZONE_OPTIONS.some(option => option.value === fallback)) {
    return fallback;
  }

  return null;
};

export const getCourseTimeZone = (course: Pick<Course, 'timeZone'>): string => {
  return course.timeZone || DEFAULT_COURSE_TIME_ZONE;
};

export const isValidCourseTime = (time?: string): time is string =>
  Boolean(time && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time));

export const parseTimeToMinutes = (time?: string): number => {
  const resolvedTime = isValidCourseTime(time) ? time : DEFAULT_COURSE_START_TIME;
  const [hours, minutes] = resolvedTime.split(':').map(Number);
  return hours * 60 + minutes;
};

export const getWeekCalendarTop = (startMinutes: number, hourHeight: number): number =>
  Math.max(0, ((startMinutes - WEEK_CALENDAR_START_HOUR * 60) / 60) * hourHeight);

const getTimeZoneParts = (date: Date, timeZone: string): Record<string, number> => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  return formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = Number(part.value);
    }
    return acc;
  }, {} as Record<string, number>);
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string): number => {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second || 0);
  return asUtc - date.getTime();
};

export const zonedCourseTimeToInstant = (dateString: string, time: string, timeZone: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hours || 0, minutes || 0));
  const firstOffset = getTimeZoneOffsetMs(utcGuess, timeZone);
  const firstInstant = new Date(utcGuess.getTime() - firstOffset);
  const secondOffset = getTimeZoneOffsetMs(firstInstant, timeZone);
  return new Date(utcGuess.getTime() - secondOffset);
};

export const formatInstantTimeInZone = (instant: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instant);

export const getCourseTimeRangeForZone = (
  course: Pick<Course, 'startDate' | 'startTime' | 'endTime' | 'timeZone'>,
  displayTimeZone = DEFAULT_COURSE_TIME_ZONE,
  date?: Date,
): { label: string; startMinutes: number; endMinutes: number; displayTimeZone: string; courseTimeZone: string } => {
  const courseTimeZone = getCourseTimeZone(course);
  const dateString = date ? formatLocalDateKey(date) : course.startDate;
  const startTime = course.startTime || DEFAULT_COURSE_START_TIME;
  const endTime = course.endTime || DEFAULT_COURSE_END_TIME;

  if (courseTimeZone === displayTimeZone) {
    return {
      label: `${startTime} - ${endTime} (${displayTimeZone})`,
      startMinutes: parseTimeToMinutes(startTime),
      endMinutes: parseTimeToMinutes(endTime),
      displayTimeZone,
      courseTimeZone,
    };
  }

  const startInstant = zonedCourseTimeToInstant(dateString, startTime, courseTimeZone);
  const endInstant = zonedCourseTimeToInstant(dateString, endTime, courseTimeZone);
  const displayStartTime = formatInstantTimeInZone(startInstant, displayTimeZone);
  const displayEndTime = formatInstantTimeInZone(endInstant, displayTimeZone);
  const sourceLabel = `origen ${courseTimeZone}`;

  return {
    label: `${displayStartTime} - ${displayEndTime} (${displayTimeZone}, ${sourceLabel})`,
    startMinutes: parseTimeToMinutes(displayStartTime),
    endMinutes: Math.max(parseTimeToMinutes(displayEndTime), parseTimeToMinutes(displayStartTime) + 30),
    displayTimeZone,
    courseTimeZone,
  };
};

export const formatCourseTimeRange = (course: Pick<Course, 'startTime' | 'endTime' | 'timeZone'>): string => {
  const startTime = course.startTime || DEFAULT_COURSE_START_TIME;
  const endTime = course.endTime || DEFAULT_COURSE_END_TIME;
  return `${startTime} - ${endTime} (${getCourseTimeZone(course)})`;
};
