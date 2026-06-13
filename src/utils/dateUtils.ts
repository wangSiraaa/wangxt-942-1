export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const getDatesBetween = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  
  const current = new Date(start);
  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
};

export const getDatesForNights = (checkinDate: string, checkoutDate: string): string[] => {
  const dates: string[] = [];
  const start = parseDate(checkinDate);
  const end = parseDate(checkoutDate);
  
  const current = new Date(start);
  while (current < end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
};

export const getNightsBetween = (checkinDate: string, checkoutDate: string): number => {
  const start = parseDate(checkinDate);
  const end = parseDate(checkoutDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const isWeekend = (dateStr: string): boolean => {
  const date = parseDate(dateStr);
  const day = date.getDay();
  return day === 0 || day === 6;
};

export const isSameDay = (date1: string, date2: string): boolean => {
  return formatDate(date1) === formatDate(date2);
};

export const isDateInRange = (date: string, startDate: string, endDate: string): boolean => {
  return date >= startDate && date <= endDate;
};

export const addDays = (dateStr: string, days: number): string => {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
};

export const getDaysDiff = (date1: string, date2: string): number => {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getToday = (): string => {
  return formatDate(new Date());
};

export const getMonthStart = (dateStr: string): string => {
  const date = parseDate(dateStr);
  return formatDate(new Date(date.getFullYear(), date.getMonth(), 1));
};

export const getMonthEnd = (dateStr: string): string => {
  const date = parseDate(dateStr);
  return formatDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
};

export const getMonthMatrix = (year: number, month: number): (string | null)[][] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  
  const matrix: (string | null)[][] = [];
  let currentWeek: (string | null)[] = [];
  
  for (let i = 0; i < startDayOfWeek; i++) {
    currentWeek.push(null);
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(formatDate(new Date(year, month, day)));
    if (currentWeek.length === 7) {
      matrix.push(currentWeek);
      currentWeek = [];
    }
  }
  
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    matrix.push(currentWeek);
  }
  
  return matrix;
};

export const getMonthName = (month: number): string => {
  const names = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  return names[month];
};

export const getWeekdayNames = (): string[] => {
  return ['日', '一', '二', '三', '四', '五', '六'];
};

export const HOLIDAYS_2026: string[] = [
  '2026-01-01', '2026-01-02', '2026-01-03',
  '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20',
  '2026-04-04', '2026-04-05', '2026-04-06',
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
  '2026-06-19', '2026-06-20', '2026-06-21',
  '2026-09-25', '2026-09-26', '2026-09-27',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07',
];

export const isHoliday = (dateStr: string): boolean => {
  return HOLIDAYS_2026.includes(dateStr);
};
