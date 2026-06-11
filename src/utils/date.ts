export const fmt = (n: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

export const pad = (n: number) => n.toString().padStart(2, '0');

export const toISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayISO = () => toISO(new Date());

export const addDays = (d: Date | string, n: number) => {
  const date = typeof d === 'string' ? parseISO(d) : new Date(d);
  date.setDate(date.getDate() + n);
  return date;
};

export const addDaysISO = (d: string, n: number) => toISO(addDays(d, n));

export const diffDays = (start: string, end: string) => {
  const s = parseISO(start).getTime();
  const e = parseISO(end).getTime();
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
};

export const isWeekend = (d: string) => {
  const day = parseISO(d).getDay();
  return day === 0 || day === 6;
};

export const dateRange = (start: string, end: string): string[] => {
  const days: string[] = [];
  const nights = diffDays(start, end);
  for (let i = 0; i < nights; i++) {
    days.push(addDaysISO(start, i));
  }
  return days;
};

export const isBetween = (date: string, start: string, end: string, inclusive = false) => {
  const d = parseISO(date).getTime();
  const s = parseISO(start).getTime();
  const e = parseISO(end).getTime();
  return inclusive ? d >= s && d <= e : d >= s && d < e;
};

export const rangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => {
  return parseISO(aStart) < parseISO(bEnd) && parseISO(aEnd) > parseISO(bStart);
};

export const fmtDateCN = (iso: string) => {
  const d = parseISO(iso);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
};

export const fmtShort = (iso: string) => {
  const d = parseISO(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

export const monthGrid = (year: number, month: number): (Date | null)[] => {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startWeekday = first.getDay();
  const daysInMonth = last.getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

export const fmtMonthYear = (year: number, month: number) =>
  `${year} 年 ${month + 1} 月`;
