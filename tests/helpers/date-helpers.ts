function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function nextBusinessDay(date: Date): Date {
  let result = date;
  while (isWeekend(result)) {
    result = addUtcDays(result, 1);
  }
  return result;
}

function buildUtcIso(date: Date, time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes, 0, 0)
  ).toISOString();
}

export function nextBusinessDayAt(time: string): string {
  return buildUtcIso(nextBusinessDay(addUtcDays(new Date(), 2)), time);
}

export function daysFromNowAt(days: number, time: string): string {
  return buildUtcIso(nextBusinessDay(addUtcDays(new Date(), days)), time);
}

export function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function pastDateAt(time: string): string {
  return buildUtcIso(addUtcDays(new Date(), -1), time);
}

export function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function toTimeOnly(iso: string): string {
  return iso.slice(11, 16);
}
