/**
 * Parse chuỗi "HH:MM:SS DD/MM/YYYY" -> Date, trả null nếu không hợp lệ
 * Port verbatim from view_home.ejs parseTs()
 */
export function parseTs(str: string | undefined | null): Date | null {
  if (!str || typeof str !== 'string' || str.trim() === '') return null;
  const parts = str.trim().split(' ');
  if (parts.length < 2) return null;
  const timeParts = parts[0].split(':');
  const dateParts = parts[1].split('/');
  if (timeParts.length < 3 || dateParts.length < 3) return null;
  const h = parseInt(timeParts[0], 10);
  const m = parseInt(timeParts[1], 10);
  const s = parseInt(timeParts[2], 10);
  const d = parseInt(dateParts[0], 10);
  const mo = parseInt(dateParts[1], 10);
  const y = parseInt(dateParts[2], 10);
  if (isNaN(h) || isNaN(m) || isNaN(s) || isNaN(d) || isNaN(mo) || isNaN(y)) return null;
  return new Date(y, mo - 1, d, h, m, s);
}

/**
 * Parse chuỗi "HH:MM:SS DD/MM/YYYY" -> Date (used in batch detail render)
 * Port verbatim from view_home.ejs parseDate()
 */
export function parseDate(str: string): Date {
  const [time, date] = str.split(' ');
  const [hour, minute, second] = time.split(':').map(Number);
  const [day, month, year] = date.split('/').map(Number);
  return new Date(year, month - 1, day, hour, minute, second);
}

/**
 * Get duration between two time strings
 * Port verbatim from view_home.ejs getDuration()
 */
export function getDuration(start: string, end: string): { minutes: string; text: string } {
  const s = parseDate(start);
  const e = parseDate(end);
  const diff = e.getTime() - s.getTime();
  return {
    minutes: (diff / 60000).toFixed(2),
    text: `${Math.floor(diff / 60000)} phút ${Math.floor(diff / 1000) % 60} giây`,
  };
}
